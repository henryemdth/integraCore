import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import type { User } from "@integracore/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateUserDialog } from "@/components/users/CreateUserDialog"
import { EditUserDialog } from "@/components/users/EditUserDialog"
import { ResetPasswordDialog } from "@/components/users/ResetPasswordDialog"
import { Plus, MoreHorizontal } from "lucide-react"

export default function UserListPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active")

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get("/api/users")
      setUsers(res.data.users)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filtered = users.filter((u) => {
    if (filter === "active") return u.active === 1
    if (filter === "inactive") return u.active === 0
    return true
  })

  const handleDeactivate = async (user: User) => {
    if (!confirm(`Deactivate ${user.full_name}? They won't be able to log in.`)) return
    try {
      await api.patch(`/api/users/${user.id}/deactivate`)
      fetchUsers()
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to deactivate user")
    }
  }

  const handleActivate = async (user: User) => {
    try {
      await api.patch(`/api/users/${user.id}/activate`)
      fetchUsers()
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to activate user")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New User
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <span className="text-sm text-muted-foreground">
              {filtered.length} user{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? "outline" : "destructive"}>
                        {user.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditUser(user)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetPwdUser(user)}>
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.active ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeactivate(user)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleActivate(user)}>
                              Activate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={fetchUsers} />
      <EditUserDialog
        user={editUser}
        open={Boolean(editUser)}
        onOpenChange={(o: boolean) => { if (!o) setEditUser(null) }}
        onSuccess={fetchUsers}
      />
      <ResetPasswordDialog
        user={resetPwdUser}
        open={Boolean(resetPwdUser)}
        onOpenChange={(o: boolean) => { if (!o) setResetPwdUser(null) }}
      />
    </div>
  )
}
