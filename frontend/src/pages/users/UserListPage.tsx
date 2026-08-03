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
import { Skeleton } from "@/components/ui/skeleton"
import { CreateUserDialog } from "@/components/users/CreateUserDialog"
import { EditUserDialog } from "@/components/users/EditUserDialog"
import { ResetPasswordDialog } from "@/components/users/ResetPasswordDialog"
import { StatCard } from "@/components/StatCard"
import { QueryErrorState } from "@/components/ui/query-error"
import { Plus, MoreHorizontal, Users, UserCheck, Shield } from "lucide-react"
import { formatDateTime } from "@/lib/format"

export default function UserListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active")
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null)

  const limit = 10
  const params: Record<string, string> = { page: String(page), limit: String(limit) }
  if (filter !== "all") params.active = filter

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users", params],
    queryFn: async () => {
      const res = await api.get(`/api/users?${new URLSearchParams(params)}`)
      return { users: res.data.users as User[], total: res.data.total as number, totalPages: res.data.totalPages as number }
    },
    placeholderData: (prev) => prev,
  })

  const users = data?.users ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const { data: allUsers } = useQuery({
    queryKey: ["users", "stats"],
    queryFn: async () => {
      const res = await api.get("/api/users?limit=1000")
      return res.data.users as User[]
    },
  })

  const activeCount = allUsers?.filter((u) => u.active).length ?? 0
  const adminCount = allUsers?.filter((u) => u.role === "admin").length ?? 0

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

  const resetPage = () => setPage(1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-lg">{t("users.title")}</h2>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("users.newUser")}</Button>
      </div>

      <div className="grid gap-4 grid-cols-3">
        <StatCard label={t("users.stats.total")} value={total} icon={Users} loading={isLoading || !allUsers} />
        <StatCard label={t("users.stats.active")} value={activeCount} icon={UserCheck} loading={isLoading || !allUsers} />
        <StatCard label={t("users.stats.admins")} value={adminCount} icon={Shield} loading={isLoading || !allUsers} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="space-y-1.5">
              <Select value={filter} onValueChange={(v) => { setFilter(v as any); resetPage() }}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("users.active")}</SelectItem>
                  <SelectItem value="inactive">{t("users.inactive")}</SelectItem>
                  <SelectItem value="all">{t("users.all")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
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
              {isError ? (
                <TableRow><TableCell colSpan={6} className="py-4"><QueryErrorState onRetry={refetch} /></TableCell></TableRow>
              ) : isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14 rounded-sm" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14 rounded-sm" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{t("users.noUsers")}</TableCell></TableRow>
              ) : users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell><Badge variant={user.role === "admin" ? "info" : "secondary"}>{user.role}</Badge></TableCell>
                  <TableCell><Badge variant={user.active ? "success-light" : "error-light"}>{user.active ? t("users.active") : t("users.inactive")}</Badge></TableCell>
                  <TableCell className="text-body-sm text-muted-foreground">{formatDateTime(user.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">{t("users.pageInfo", { page, totalPages, total })}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.previous")}</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDialog user={editUser} open={Boolean(editUser)} onOpenChange={(o: boolean) => { if (!o) setEditUser(null) }} />
      <ResetPasswordDialog user={resetPwdUser} open={Boolean(resetPwdUser)} onOpenChange={(o: boolean) => { if (!o) setResetPwdUser(null) }} />
    </div>
  )
}
