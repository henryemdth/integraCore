import { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ imported: number; errors: { row: number; sku: string; error: string }[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) return
      const buffer = await file.arrayBuffer()
      const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""))
      const res = await api.post("/api/products/import", { file: base64 })
      setResult(res.data)
      return res.data
    },
    onSuccess: (data: any) => {
      if (data?.imported > 0) {
        queryClient.invalidateQueries({ queryKey: ["products"] })
        toast.success(t("products.import.imported", { count: data.imported }))
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error || t("products.import.failedImport")),
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
            <Alert>
              <AlertDescription>
                {t("products.import.imported", { count: result.imported })}
                {result.errors.length > 0 && (
                  <span className="block mt-1 text-destructive">
                    {t("products.import.errors", { count: result.errors.length, details: result.errors.map((e) => t("products.import.rowError", { row: e.row, error: e.error })).join("; ") })}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept=".xlsx"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
