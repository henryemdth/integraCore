import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation } from "@tanstack/react-query"
import api from "@/lib/api"
import type { User } from "@integracore/shared"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

interface ResetPasswordDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResetPasswordDialog({ user, open, onOpenChange }: ResetPasswordDialogProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) return
      await api.put(`/api/users/${user.id}/password`, { password })
    },
    onSuccess: () => {
      toast.success(t("users.resetPwd.success"))
      setPassword("")
      onOpenChange(false)
    },
    onError: (err: any) => setError(err.response?.data?.error || t("users.resetPwd.failed")),
  })

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPassword(""); setError("") }; onOpenChange(o) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.resetPwd.title")}</DialogTitle>
          <DialogDescription>{t("users.resetPwd.desc", { username: user.username })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setError(""); mutation.mutate() }} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label htmlFor="rp-password">{t("users.resetPwd.newPassword")}</Label>
            <Input id="rp-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("users.resetPwd.placeholder")} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
            <Button type="submit" disabled={mutation.isPending || !password} variant="destructive">{mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{mutation.isPending ? t("users.resetPwd.resetting") : t("users.resetPwd.reset")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
