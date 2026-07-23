import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import type { User } from "@integracore/shared"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CreateUserDialog } from "@/components/users/CreateUserDialog"
import { EditUserDialog } from "@/components/users/EditUserDialog"
import { ResetPasswordDialog } from "@/components/users/ResetPasswordDialog"
import { Plus, MoreHorizontal } from "lucide-react"

export default function UserListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active")
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => { const res = await api.get("/api/users"); return res.data.users as User[] },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/users/${id}/deactivate`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); toast.success(t("users.deactivated")) },
    onError: (err: any) => toast.error(err.response?.data?.error || t("users.failedDeactivate")),
  })

  const activateMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/users/${id}/activate`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); toast.success(t("users.activated")) },
    onError: (err: any) => toast.error(err.response?.data?.error || t("users.failedActivate")),
  })

  const filtered = users.filter((u) => {
    if (filter === "active") return u.active === 1
    if (filter === "inactive") return u.active === 0
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{t("users.title")}</h2>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("users.newUser")}</Button>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("users.active")}</SelectItem>
                  <SelectItem value="inactive">{t("users.inactive")}</SelectItem>
                  <SelectItem value="all">{t("users.all")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <span className="text-sm text-muted-foreground">{t("users.count", { count: filtered.length })}</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("users.username")}</TableHead>
                <TableHead>{t("users.fullName")}</TableHead>
                <TableHead>{t("users.role")}</TableHead>
                <TableHead>{t("users.status")}</TableHead>
                <TableHead>{t("users.created")}</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("users.noUsers")}</TableCell></TableRow>
              ) : filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell><Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge></TableCell>
                  <TableCell><Badge variant={user.active ? "outline" : "destructive"}>{user.active ? t("users.active") : t("users.inactive")}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditUser(user)}>{t("common.edit")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResetPwdUser(user)}>{t("users.resetPassword")}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.active ? (
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm(t("users.confirmDeactivate", { name: user.full_name }))) deactivateMutation.mutate(user.id) }}>{t("users.deactivate")}</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => activateMutation.mutate(user.id)}>{t("users.activate")}</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDialog user={editUser} open={Boolean(editUser)} onOpenChange={(o: boolean) => { if (!o) setEditUser(null) }} />
      <ResetPasswordDialog user={resetPwdUser} open={Boolean(resetPwdUser)} onOpenChange={(o: boolean) => { if (!o) setResetPwdUser(null) }} />
    </div>
  )
}
