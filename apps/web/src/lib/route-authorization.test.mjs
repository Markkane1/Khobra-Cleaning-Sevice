import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('booking creation and cleaner availability allow only admins and customers', () => {
  for (const path of ['../app/api/khobra-cleaning/bookings/route.ts', '../app/api/khobra-cleaning/employees/availability/route.ts']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /requireAuth\(req, \['admin', 'customer'\]\)/)
  }
  const availability = readFileSync(new URL('../app/api/khobra-cleaning/employees/availability/route.ts', import.meta.url), 'utf8')
  assert.match(availability, /auth\.session\.role === 'customer'/)
  assert.match(availability, /busyEmployees: \[\]/)
  assert.match(availability, /onLeaveEmployees: \[\]/)
  assert.match(availability, /allEmployeesStatus: publicEmployees/)
})

test('role changes preserve an administrator and require operational profiles', () => {
  const source = readFileSync(new URL('../app/api/khobra-cleaning/rbac/route.ts', import.meta.url), 'utf8')
  assert.match(source, /FOR UPDATE/)
  assert.match(source, /must retain at least one active administrator/)
  assert.match(source, /Create a \$\{role\} profile before assigning this role/)
  const reset = source.slice(source.indexOf('export async function PATCH'), source.indexOf('export function POST'))
  assert.match(reset, /status: 'active'/)
  assert.doesNotMatch(reset, /data: \{ passwordHash: hashPassword\(temporaryPassword\), status: 'active'/)
})

test('notification read state is always scoped to the signed-in user', () => {
  const source = readFileSync(new URL('../app/api/khobra-cleaning/notifications/route.ts', import.meta.url), 'utf8')
  const put = source.slice(source.indexOf('export async function PUT'), source.indexOf('export async function POST'))
  assert.match(put, /OR: \[\{ userId: auth\.session\.userId \}, \{ userId: null \}\]/)
  assert.doesNotMatch(put, /auth\.session\.role === 'admin'/)
})

test('non-admin booking responses redact personnel, inventory, and payment internals', () => {
  const source = readFileSync(new URL('../app/api/khobra-cleaning/bookings/route.ts', import.meta.url), 'utf8')
  const get = source.slice(source.indexOf('export async function GET'), source.indexOf('export async function POST'))
  assert.match(get, /materialReservations: _materialReservations/)
  assert.match(get, /inventoryItem: _inventoryItem/)
  assert.match(get, /\{ id, employeeId, status, customerRating, employee \}/)
  assert.match(get, /safe\.pickupAlerts = \[\]/)
  assert.match(get, /safe\.rating = booking\.rating \? \{ overallRating:/)
  assert.match(get, /delete safe\.createdBy/)
  assert.match(get, /safe\.statusHistory = booking\.statusHistory\?\.map/)
  assert.match(get, /auth\.session\.role === 'driver'\) safe\.invoices = \[\]/)
  assert.match(get, /payments: invoice\.payments\?\.map\(\(\{ id, method, status, reconciliationStatus, receivedAt, verifiedAt, createdAt \}/)
})

test('customer self-service cannot read or write internal CRM notes', () => {
  const source = readFileSync(new URL('../app/api/khobra-cleaning/customers/route.ts', import.meta.url), 'utf8')
  assert.match(source, /\{ notes: _notes, preferences: _preferences, \.\.\.customer \}/)
  const customerBranch = source.slice(source.indexOf("const customerData = auth.session.role === 'customer'"), source.indexOf('const updated ='))
  for (const field of ['id', 'name', 'email', 'phone', 'city', 'address', 'area', 'addresses']) assert.match(customerBranch, new RegExp(`${field}: validatedData\\.${field}`))
  assert.doesNotMatch(customerBranch, /notes|preferences/)
})

test('non-admin service listings expose catalog fields, not internal materials', () => {
  const source = readFileSync(new URL('../app/api/khobra-cleaning/services/route.ts', import.meta.url), 'utf8')
  const get = source.slice(source.indexOf('export async function GET'), source.indexOf('export async function POST'))
  assert.match(get, /\{ id, name, description, category, baseRate, withMaterialsRate, minDuration, galleryImages, heroImages \}/)
  assert.doesNotMatch(get, /inventoryItem|quantityPerCleanerHour/)
})

test('profile deletion cannot deactivate an administrator account', () => {
  for (const file of [
    '../../../../packages/db/src/repositories/PrismaCustomerRepository.ts',
    '../../../../packages/db/src/repositories/PrismaEmployeeRepository.ts',
    '../../../../packages/db/src/repositories/PrismaDriverRepository.ts',
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /user\.role === 'admin'/)
    assert.match(source, /administrator role before deleting/)
    assert.match(source, /status: 409/)
  }
})
