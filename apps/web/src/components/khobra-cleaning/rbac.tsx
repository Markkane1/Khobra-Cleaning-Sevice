'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Search, ShieldCheck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api-client'

type Role = { id: 'admin' | 'driver' | 'customer' | 'cleaner'; name: string; description: string }
type User = { id: string; name: string; email: string; role: Role['id']; status: string }
type RbacData = { roles: Role[]; users: User[] }

export function RBACManagement() {
  const [search, setSearch] = useState('')
  const [resetCredential, setResetCredential] = useState<{ name: string; password: string } | null>(null)
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<RbacData>({ queryKey: ['rbac'], queryFn: () => apiRequest<RbacData>('/api/khobra-cleaning/rbac') })
  const assign = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role['id'] }) => apiRequest('/api/khobra-cleaning/rbac', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) }),
    onSuccess: () => { toast.success('User role updated'); queryClient.invalidateQueries({ queryKey: ['rbac'] }) },
    onError: (error: Error) => toast.error(error.message),
  })
  const users = useMemo(() => (data?.users || []).filter(user => `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())), [data?.users, search])
  const resetPassword = useMutation({
    mutationFn: async (user: User) => {
      const result = await apiRequest<{ temporaryPassword: string }>('/api/khobra-cleaning/rbac', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) })
      return { name: user.name, password: result.temporaryPassword }
    },
    onSuccess: setResetCredential,
    onError: (error: Error) => toast.error(error.message),
  })

  return <div className="space-y-6 p-1">
    <div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><ShieldCheck /></div><div><h1 className="text-2xl font-black">Access Control</h1><p className="text-sm text-muted-foreground">Assign one of the four supported operational roles.</p></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{(data?.roles || []).map(role => <Card key={role.id}><CardHeader className="pb-3"><CardTitle className="text-base">{role.name}</CardTitle><CardDescription>{role.description}</CardDescription></CardHeader></Card>)}</div>
    {resetCredential && <Card className="border-amber-300 bg-amber-50"><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6"><div><p className="font-semibold">Temporary password for {resetCredential.name}</p><code className="select-all text-sm">{resetCredential.password}</code><p className="text-xs text-muted-foreground">Copy it now; it is not shown again.</p></div><Button variant="outline" onClick={() => setResetCredential(null)}>Dismiss</Button></CardContent></Card>}
    <Card>
      <CardHeader><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User roles</CardTitle><CardDescription>Changing a role immediately revokes that user&apos;s existing sessions.</CardDescription></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search users" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users" className="pl-9 sm:w-72" /></div></div></CardHeader>
      <CardContent>{isLoading ? <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : <Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Status</TableHead><TableHead className="w-52">Role</TableHead><TableHead className="w-28">Login</TableHead></TableRow></TableHeader><TableBody>{users.map(user => <TableRow key={user.id}><TableCell><p className="font-semibold">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></TableCell><TableCell><Badge variant={user.status === 'active' ? 'default' : 'secondary'}>{user.status}</Badge></TableCell><TableCell><Select value={user.role} disabled={assign.isPending} onValueChange={role => assign.mutate({ userId: user.id, role: role as Role['id'] })}><SelectTrigger aria-label={`Role for ${user.name}`}><SelectValue /></SelectTrigger><SelectContent>{(data?.roles || []).map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Button size="sm" variant="outline" disabled={resetPassword.isPending} onClick={() => resetPassword.mutate(user)}><KeyRound className="mr-1 h-3.5 w-3.5" />Reset</Button></TableCell></TableRow>)}{!users.length && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No users found.</TableCell></TableRow>}</TableBody></Table>}</CardContent>
    </Card>
  </div>
}
