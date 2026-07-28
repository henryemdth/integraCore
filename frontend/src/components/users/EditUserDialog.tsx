import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import api from "@/lib/api"
import type { User } from "@integracore/shared"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface EditUserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<"admin" | "user">("user")
  const [error, setError] = useState("")
  const queryClient = useQueryClient()

  useEffect(() => { if (user) { setFullName(user.full_name); setRole(user.role); setError("") } }, [user])

  const isSelf = currentUser?.id === user?.id

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) return
      await api.put(`/api/users/${user.id}`, { full_name: fullName, role: isSelf ? undefined : role })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(t("users.edit.saved"))
      onOpenChange(false)
    },
    onError: (err: any) => setError(err.response?.data?.error || t("users.edit.failedSave")),
  })

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.edit.title")}</DialogTitle>
          <DialogDescription>{t("users.edit.desc", { username: user.username })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setError(""); mutation.mutate() }} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label htmlFor="eu-fullname">{t("users.fullName")}</Label>
            <Input id="eu-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t("users.role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")} disabled={isSelf}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t("users.create.roleSeller")}</SelectItem>
                <SelectItem value="admin">{t("users.create.roleAdmin")}</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && <p className="text-xs text-muted-foreground">{t("users.edit.selfRoleHint")}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{mutation.isPending ? t("users.edit.saving") : t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
