import { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { toast } from "sonner"
import { fileToBase64 } from "@/lib/files"
import { queryKeys } from "@/lib/queryKeys"
import { useExportExcel } from "@/hooks/useExportExcel"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Loader2 } from "lucide-react"
import { getErrorMessage, getImportRowError } from "@/lib/errorMessages"

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ imported: number; errors: { row: number; sku: string; error: string; code?: string }[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { exportToExcel } = useExportExcel()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) return
      const base64 = await fileToBase64(file)
      const res = await api.post("/api/products/import", { file: base64 })
      setResult(res.data)
      return res.data
    },
    onSuccess: (data: { imported: number }) => {
      if (data?.imported > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
        toast.success(t("products.import.imported", { count: data.imported }))
      }
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "products.import.failedImport")),
  })

  const handleClose = () => { setFile(null); setResult(null); onOpenChange(false) }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("products.import.title")}</DialogTitle>
          <DialogDescription>{t("products.import.desc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
          {result && (
            <div className="space-y-3">
              <Alert>
                <AlertDescription>{t("products.import.imported", { count: result.imported })}</AlertDescription>
              </Alert>
              {result.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-body-sm font-medium text-destructive">
                    {t("products.import.errors", { count: result.errors.length })}
                  </p>
                  <ul className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-md p-2 list-none">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-body-sm text-destructive">
                        {t("products.import.rowError", { row: e.row, error: getImportRowError(e) })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept=".xlsx"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button type="button" variant="outline" size="sm"
              onClick={() => exportToExcel("/api/products/import-template", {}, t("products.import.templateFilename"))}>
              <Download className="h-4 w-4 mr-2" />{t("products.import.downloadTemplate")}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>{result ? t("common.close") : t("common.cancel")}</Button>
            {!result && <Button type="submit" disabled={!file || mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mutation.isPending ? t("products.import.importing") : t("products.import.title")}
            </Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
