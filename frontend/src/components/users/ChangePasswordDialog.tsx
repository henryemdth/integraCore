import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation } from "@tanstack/react-query"
import api from "@/lib/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: async () => {
      await api.put("/api/auth/password", { current_password: currentPassword, new_password: newPassword })
    },
    onSuccess: () => {
      toast.success(t("changePassword.success"))
      setCurrentPassword(""); setNewPassword("")
      onOpenChange(false)
    },
    onError: (err: any) => setError(err.response?.data?.error || t("changePassword.failed")),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setCurrentPassword(""); setNewPassword(""); setError("") }; onOpenChange(o) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("changePassword.title")}</DialogTitle>
          <DialogDescription>{t("changePassword.desc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setError(""); mutation.mutate() }} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label htmlFor="cp-current">{t("changePassword.currentPassword")}</Label>
            <Input id="cp-current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new">{t("changePassword.newPassword")}</Label>
            <Input id="cp-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("users.create.min6chars")} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={mutation.isPending || !currentPassword || !newPassword}>{mutation.isPending ? t("changePassword.changing") : t("changePassword.title")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
