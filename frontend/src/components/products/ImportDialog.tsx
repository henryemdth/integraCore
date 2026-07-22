import { useState, useRef } from "react"
import api from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportDialog({ open, onOpenChange, onSuccess }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ imported: number; errors: { row: number; sku: string; error: string }[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setError("")
    setResult(null)
    setLoading(true)

    try {
      const buffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      )
      const res = await api.post("/api/products/import", { file: base64 })
      setResult(res.data)
      if (res.data.imported > 0) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to import file")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setError("")
    setResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Products from Excel</DialogTitle>
          <DialogDescription>
            Upload an .xlsx file. Expected columns: Name, SKU, Category, Price, Stock, Low Stock Threshold
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {result && (
            <Alert>
              <AlertDescription>
                Imported {result.imported} product(s).
                {result.errors.length > 0 && (
                  <span className="block mt-1 text-destructive">
                    {result.errors.length} error(s):{" "}
                    {result.errors.map((e) => `Row ${e.row}: ${e.error}`).join("; ")}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button type="submit" disabled={!file || loading}>
                {loading ? "Importing..." : "Import"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
