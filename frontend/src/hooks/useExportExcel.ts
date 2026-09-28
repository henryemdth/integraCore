import { useCallback } from "react"
import api from "@/lib/api"
import { downloadBlob } from "@/lib/files"
import { toast } from "sonner"
import i18n from "i18next"

export function useExportExcel() {
  const exportToExcel = useCallback(async (endpoint: string, params?: Record<string, string>, filename = "export.xlsx") => {
    try {
      const searchParams = new URLSearchParams()
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v && v !== "all") searchParams.set(k, v)
        }
      }
      const res = await api.get(`${endpoint}?${searchParams}`, { responseType: "blob" })
      downloadBlob(res.data, filename)
      toast.success(i18n.t("export.exported", { filename }))
    } catch {
      toast.error(i18n.t("export.failedExport"))
    }
  }, [])

  return { exportToExcel }
}
