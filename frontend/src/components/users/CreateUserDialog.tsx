import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "user">("user")
  const [error, setError] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/auth/register", { username, password, full_name: fullName, role })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(t("users.create.created"))
      setUsername(""); setFullName(""); setPassword(""); setRole("user")
      onOpenChange(false)
    },
    onError: (err: any) => setError(err.response?.data?.error || t("users.create.failedCreate")),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.create.title")}</DialogTitle>
          <DialogDescription>{t("users.create.desc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); setError(""); mutation.mutate() }} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label htmlFor="cu-username">{t("users.username")}</Label>
            <Input id="cu-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("users.create.min3chars")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-fullname">{t("users.fullName")}</Label>
            <Input id="cu-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("users.create.namePlaceholder")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-password">{t("users.auth.password")}</Label>
            <Input id="cu-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("users.create.min6chars")} required />
          </div>
          <div className="space-y-2">
            <Label>{t("users.role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t("users.create.roleSeller")}</SelectItem>
                <SelectItem value="admin">{t("users.create.roleAdmin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{mutation.isPending ? t("users.create.creating") : t("users.create.title")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
