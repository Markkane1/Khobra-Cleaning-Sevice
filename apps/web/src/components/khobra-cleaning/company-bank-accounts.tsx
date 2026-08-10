'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CompanyBankAccountSchema } from '@repo/core'
import { apiRequest } from '@/lib/api-client'
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Check,
  Star,
  ShieldCheck,
  AlertCircle,
  Copy,
  ArrowUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'

const emptyAccountForm = {
  id: '',
  accountTitle: '',
  bankName: '',
  accountNumber: '',
  iban: '',
  branchName: '',
  branchCode: '',
  currency: 'AED',
  instructions: '',
  displayOrder: 1,
  isActive: true,
  isDefault: false,
}

export function CompanyBankAccounts() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null)
  const [form, setForm] = useState(emptyAccountForm)

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['companyBankAccounts'],
    queryFn: () => apiRequest<any>('/api/khobra-cleaning/company-bank-accounts'),
  })

  const saveMut = useMutation({
    mutationFn: (d: any) =>
      apiRequest('/api/khobra-cleaning/company-bank-accounts', {
        method: d.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companyBankAccounts'] })
      qc.invalidateQueries({ queryKey: ['bankAccount'] })
      toast.success(form.id ? 'Company bank account updated!' : 'Company bank account added!')
      setDialogOpen(false)
      setForm(emptyAccountForm)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Save failed')
    },
  })

  const toggleActiveMut = useMutation({
    mutationFn: (d: { id: string; isActive: boolean }) =>
      apiRequest('/api/khobra-cleaning/company-bank-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleActive', id: d.id, isActive: d.isActive }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companyBankAccounts'] })
      qc.invalidateQueries({ queryKey: ['bankAccount'] })
      toast.success('Active status updated!')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Update failed')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiRequest<any>(`/api/khobra-cleaning/company-bank-accounts?id=${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['companyBankAccounts'] })
      qc.invalidateQueries({ queryKey: ['bankAccount'] })
      toast.success(data.message || 'Company bank account deleted!')
      setDeleteDialogOpen(false)
      setSelectedAccount(null)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Delete failed')
    },
  })

  const accounts = accountsData?.accounts || []
  const accountValidation = CompanyBankAccountSchema.safeParse(form)
  const showAccountValidation = Boolean(form.accountTitle || form.bankName || form.accountNumber || form.iban)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-600" />
            Company Bank Accounts
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage official company bank accounts for customer bank transfer payments, display order, default currencies, and transfer memo instructions.
          </p>
        </div>

        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4"
          onClick={() => {
            setForm({ ...emptyAccountForm, displayOrder: accounts.length + 1 })
            setDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Bank Account
        </Button>
      </div>

      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Configured Accounts ({accounts.length})</CardTitle>
          <CardDescription className="text-xs">
            Only active bank accounts are presented to customers during payment method selection.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold">Display Order</TableHead>
                <TableHead className="text-xs font-semibold">Account Title & Bank</TableHead>
                <TableHead className="text-xs font-semibold">Account # / IBAN</TableHead>
                <TableHead className="text-xs font-semibold">Branch & Code</TableHead>
                <TableHead className="text-xs font-semibold">Currency</TableHead>
                <TableHead className="text-xs font-semibold">Default</TableHead>
                <TableHead className="text-xs font-semibold">Active Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    Loading company bank accounts...
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    No company bank accounts configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc: any) => (
                  <TableRow key={acc.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-xs font-semibold">{acc.displayOrder || 0}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          {acc.accountTitle}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{acc.bankName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-mono font-bold text-xs text-foreground flex items-center gap-1">
                          {acc.accountNumber}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              navigator.clipboard.writeText(acc.accountNumber)
                              toast.success('Copied Account #')
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </p>
                        {acc.iban && (
                          <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {acc.iban}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {acc.branchName || acc.branchCode ? (
                        <span>
                          {acc.branchName} {acc.branchCode ? `(${acc.branchCode})` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px] font-bold">
                        {acc.currency || 'AED'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {acc.isDefault ? (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 border-amber-300 text-[10px] font-bold">
                          <Star className="h-3 w-3 mr-1 fill-amber-500 text-amber-500" /> Default
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={acc.isActive !== false}
                          onCheckedChange={(checked) => toggleActiveMut.mutate({ id: acc.id, isActive: checked })}
                        />
                        <span className={`text-xs font-semibold ${acc.isActive !== false ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {acc.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${acc.accountTitle}`}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setForm({
                              id: acc.id,
                              accountTitle: acc.accountTitle,
                              bankName: acc.bankName,
                              accountNumber: acc.accountNumber,
                              iban: acc.iban || '',
                              branchName: acc.branchName || '',
                              branchCode: acc.branchCode || '',
                              currency: acc.currency || 'AED',
                              instructions: acc.instructions || '',
                              displayOrder: acc.displayOrder || 1,
                              isActive: acc.isActive !== false,
                              isDefault: Boolean(acc.isDefault),
                            })
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${acc.accountTitle}`}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setSelectedAccount(acc)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Bank Account Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Building2 className="h-5 w-5" />
              {form.id ? 'Edit Company Bank Account' : 'Add New Company Bank Account'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure official account details that customers will use for bank transfers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <span className="font-semibold">Account Title *</span>
              <input
                className="w-full h-9 px-3 rounded-md border border-input bg-transparent mt-1"
                placeholder="e.g. Khobra Cleaning Services LLC"
                value={form.accountTitle}
                onChange={e => setForm({ ...form, accountTitle: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="font-semibold">Bank Name *</span>
                <input
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent mt-1"
                  placeholder="e.g. Emirates NBD"
                  value={form.bankName}
                  onChange={e => setForm({ ...form, bankName: e.target.value })}
                />
              </div>
              <div>
                <span className="font-semibold">Currency *</span>
                <input
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent mt-1 font-mono uppercase"
                  placeholder="AED"
                  value={form.currency}
                  onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="font-semibold">Account Number *</span>
                <input
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent mt-1 font-mono"
                  placeholder="10154829384701"
                  value={form.accountNumber}
                  onChange={e => setForm({ ...form, accountNumber: e.target.value })}
                />
              </div>
              <div>
                <span className="font-semibold">IBAN</span>
                <input
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent mt-1 font-mono"
                  placeholder="AE0302000010154829384701"
                  value={form.iban}
                  onChange={e => setForm({ ...form, iban: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="col-span-2">
                <span className="font-semibold">Branch Name</span>
                <input
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent mt-1"
                  placeholder="Downtown Dubai"
                  value={form.branchName}
                  onChange={e => setForm({ ...form, branchName: e.target.value })}
                />
              </div>
              <div>
                <span className="font-semibold">Branch Code</span>
                <input
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent mt-1 font-mono"
                  placeholder="020"
                  value={form.branchCode}
                  onChange={e => setForm({ ...form, branchCode: e.target.value })}
                />
              </div>
            </div>

            <div>
              <span className="font-semibold">Display Order Priority</span>
              <input
                type="number"
                min="1"
                className="w-full h-9 px-3 rounded-md border border-input bg-transparent mt-1 font-mono"
                placeholder="1"
                value={form.displayOrder}
                onChange={e => setForm({ ...form, displayOrder: parseInt(e.target.value || '1', 10) })}
              />
            </div>

            <div>
              <span className="font-semibold">Customer Instructions</span>
              <textarea
                className="w-full h-16 p-2 rounded-md border border-input bg-transparent mt-1 text-xs"
                placeholder="Instructions shown to customers when selecting this account..."
                value={form.instructions}
                onChange={e => setForm({ ...form, instructions: e.target.value })}
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border">
              <div>
                <p className="font-semibold">Active Status</p>
                <p className="text-[11px] text-muted-foreground">Active accounts are visible to customers</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={checked => setForm({ ...form, isActive: checked })}
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border">
              <div>
                <p className="font-semibold">Set as Default Account</p>
                <p className="text-[11px] text-muted-foreground">Default account pre-selected for {form.currency || 'AED'}</p>
              </div>
              <Switch
                checked={form.isDefault}
                onCheckedChange={checked => setForm({ ...form, isDefault: checked })}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            {(saveMut.error || (showAccountValidation && !accountValidation.success)) && (
              <p className="text-sm text-destructive sm:mr-auto" role="alert">
                {saveMut.error instanceof Error
                  ? saveMut.error.message
                  : !accountValidation.success
                    ? accountValidation.error.issues[0]?.message
                    : ''}
              </p>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={!accountValidation.success || saveMut.isPending}
              onClick={() => {
                if (accountValidation.success) saveMut.mutate(accountValidation.data)
              }}
            >
              {saveMut.isPending ? 'Saving...' : form.id ? 'Save Changes' : 'Create Bank Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Confirm Bank Account Deletion
            </DialogTitle>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-3 py-2 text-xs">
              <p>
                Are you sure you want to delete company bank account <strong className="font-mono">{selectedAccount.accountTitle} ({selectedAccount.accountNumber})</strong>?
              </p>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-900 dark:text-amber-300">
                ℹ️ <strong>Transaction Protection:</strong> If this account is linked to previous customer payment transfers, it will be safely deactivated & soft-deleted to preserve transaction history.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (selectedAccount) deleteMut.mutate(selectedAccount.id)
              }}
            >
              {deleteMut.isPending ? 'Deleting...' : 'Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
