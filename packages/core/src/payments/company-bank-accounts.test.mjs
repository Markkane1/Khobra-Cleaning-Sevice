import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CompanyBankAccountSchema,
  filterActiveBankAccounts,
  enforceSingleDefaultBankAccount,
  isValidIban,
} from './schema.ts'

test('validates CompanyBankAccountSchema required fields', () => {
  const invalid = CompanyBankAccountSchema.safeParse({})
  assert.equal(invalid.success, false)

  const valid = CompanyBankAccountSchema.safeParse({
    accountTitle: 'Khobra Cleaning Services LLC',
    bankName: 'Emirates NBD',
    accountNumber: '10154829384701',
    currency: 'AED',
    displayOrder: 1,
    isActive: true,
    isDefault: true,
  })
  assert.equal(valid.success, true)
})

test('filterActiveBankAccounts removes inactive and deleted accounts and sorts by displayOrder asc', () => {
  const accounts = [
    { id: 'acc_3', accountTitle: 'Account 3', bankName: 'Bank C', accountNumber: '333', displayOrder: 3, isActive: true },
    { id: 'acc_1', accountTitle: 'Account 1', bankName: 'Bank A', accountNumber: '111', displayOrder: 1, isActive: true },
    { id: 'acc_2', accountTitle: 'Account 2', bankName: 'Bank B', accountNumber: '222', displayOrder: 2, isActive: false },
    { id: 'acc_4', accountTitle: 'Account 4', bankName: 'Bank D', accountNumber: '444', displayOrder: 0, isActive: true, isDeleted: true },
  ]

  const activeSorted = filterActiveBankAccounts(accounts)
  assert.equal(activeSorted.length, 2)
  assert.equal(activeSorted[0].id, 'acc_1')
  assert.equal(activeSorted[1].id, 'acc_3')
})

test('enforceSingleDefaultBankAccount ensures only target account is default for a currency', () => {
  const accounts = [
    { id: 'acc_1', currency: 'AED', isDefault: true },
    { id: 'acc_2', currency: 'AED', isDefault: true },
    { id: 'acc_3', currency: 'USD', isDefault: true },
  ]

  const result = enforceSingleDefaultBankAccount(accounts, 'acc_2', 'AED')
  assert.equal(result.find(a => a.id === 'acc_1').isDefault, false)
  assert.equal(result.find(a => a.id === 'acc_2').isDefault, true)
  assert.equal(result.find(a => a.id === 'acc_3').isDefault, true) // USD remains untouched
})

test('normalizes and validates IBAN and account identifiers', () => {
  assert.equal(isValidIban('GB82 WEST 1234 5698 7654 32'), true)
  assert.equal(isValidIban('GB00 WEST 1234 5698 7654 32'), false)
  const parsed = CompanyBankAccountSchema.parse({ accountTitle: 'Company', bankName: 'Bank', accountNumber: '1234-5678', iban: 'gb82 west 1234 5698 7654 32', currency: 'aed' })
  assert.equal(parsed.iban, 'GB82WEST12345698765432')
  assert.equal(parsed.currency, 'AED')
  assert.equal(CompanyBankAccountSchema.safeParse({ accountTitle: 'Company', bankName: 'Bank', accountNumber: '../../etc/passwd', currency: 'AED' }).success, false)
})
