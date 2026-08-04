import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'

for (const file of ['apps/web/.env', 'apps/web/.env.local']) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) process.env[match[1]] ||= match[2].replace(/^"|"$/g, '')
  }
}

const { createSessionToken } = await import('./auth-crypto.ts')
const db = new PrismaClient()
const apiBase = process.env.WORKFLOW_API_BASE || 'http://localhost:3000/api/khobra-cleaning'

async function request(path, token, method = 'GET', body) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  return { response, data }
}

test('complete operational workflow passes through real API routes and persistence', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const tenant = await db.tenant.create({ data: { name: 'Workflow Validation', slug: `workflow-${suffix}` } })
  const ids = { tenantId: tenant.id, bookingIds: [] }

  try {
    const makeUser = (role, name) => db.user.create({ data: { tenantId: tenant.id, email: `${role}-${name.toLowerCase().replace(/\s/g, '-')}-${suffix}@test.local`, name, role } })
    const [adminUser, customerUser, driverUser, otherDriverUser, cleanerOneUser, cleanerTwoUser, otherCleanerUser] = await Promise.all([
      makeUser('admin', 'Admin'), makeUser('customer', 'Customer'), makeUser('driver', 'Assigned Driver'), makeUser('driver', 'Other Driver'),
      makeUser('cleaner', 'Cleaner One'), makeUser('cleaner', 'Cleaner Two'), makeUser('cleaner', 'Other Cleaner'),
    ])
    const [customer, driver, otherDriver, cleanerOne, cleanerTwo, otherCleaner, service] = await Promise.all([
      db.customer.create({ data: { tenantId: tenant.id, userId: customerUser.id, address: 'Villa 10', city: 'Dubai', area: 'Marina' } }),
      db.driver.create({ data: { tenantId: tenant.id, userId: driverUser.id, driverCode: `DRV-A-${suffix}` } }),
      db.driver.create({ data: { tenantId: tenant.id, userId: otherDriverUser.id, driverCode: `DRV-O-${suffix}` } }),
      db.employee.create({ data: { tenantId: tenant.id, userId: cleanerOneUser.id, employeeCode: `CLN-1-${suffix}` } }),
      db.employee.create({ data: { tenantId: tenant.id, userId: cleanerTwoUser.id, employeeCode: `CLN-2-${suffix}` } }),
      db.employee.create({ data: { tenantId: tenant.id, userId: otherCleanerUser.id, employeeCode: `CLN-O-${suffix}` } }),
      db.service.create({ data: { tenantId: tenant.id, name: 'Workflow Cleaning', baseRate: 100 } }),
    ])
    void otherDriver
    const token = user => createSessionToken({ userId: user.id, tenantId: tenant.id, email: user.email, role: user.role, name: user.name })
    const auth = {
      admin: token(adminUser), customer: token(customerUser), driver: token(driverUser), otherDriver: token(otherDriverUser),
      cleanerOne: token(cleanerOneUser), cleanerTwo: token(cleanerTwoUser), otherCleaner: token(otherCleanerUser),
    }
    const makeBooking = async (bookingNo, status) => {
      const booking = await db.booking.create({
        data: {
          tenantId: tenant.id, bookingNo, customerId: customer.id, driverId: driver.id, serviceId: service.id, status,
          scheduledDate: new Date(Date.now() + 86_400_000), startTime: '10:00', endTime: '12:00', duration: 2,
          employeeCount: 2, hourlyRate: 100, totalAmount: 200, netAmount: 200, address: 'Villa 10', city: 'Dubai', area: 'Marina',
          assignments: { create: [cleanerOne.id, cleanerTwo.id].map(employeeId => ({ tenantId: tenant.id, employeeId, status: status === 'completed' ? 'completed' : 'assigned' })) },
        },
      })
      ids.bookingIds.push(booking.id)
      return booking
    }

    const cashBooking = await makeBooking(`WF-CASH-${suffix}`, 'scheduled')

    let result = await request('/bookings', auth.otherDriver, 'PUT', { id: cashBooking.id, status: 'on_the_way' })
    assert.equal(result.response.status, 403, '18: unassigned driver must be rejected')
    result = await request('/bookings', auth.driver, 'PUT', { id: cashBooking.id, status: 'on_the_way' })
    assert.equal(result.response.status, 200, '1: assigned driver must mark On the Way')
    let booking = await db.booking.findUniqueOrThrow({ where: { id: cashBooking.id }, include: { statusHistory: true } })
    assert.equal(booking.status, 'on_the_way')
    assert.match(booking.statusHistory.at(-1).changedBy, /driver:/)
    let notices = await db.notification.findMany({ where: { statusHistoryId: booking.statusHistory.at(-1).id } })
    assert.deepEqual(new Set(notices.map(item => item.userId)), new Set([customerUser.id, cleanerOneUser.id, cleanerTwoUser.id]), '2: customer and every cleaner notified')

    result = await request('/bookings', auth.otherCleaner, 'PUT', { id: cashBooking.id, status: 'in_progress' })
    assert.equal(result.response.status, 403, '18: unassigned cleaner must not start work')
    result = await request('/bookings', auth.cleanerOne, 'PUT', { id: cashBooking.id, status: 'in_progress' })
    assert.equal(result.response.status, 200, '3: assigned cleaner must start work')
    booking = await db.booking.findUniqueOrThrow({ where: { id: cashBooking.id }, include: { statusHistory: true, assignments: true } })
    assert.equal(booking.status, 'in_progress')
    assert.ok(booking.assignments.find(item => item.employeeId === cleanerOne.id).startedAt)
    notices = await db.notification.findMany({ where: { statusHistoryId: booking.statusHistory.at(-1).id } })
    assert.deepEqual(new Set(notices.map(item => item.userId)), new Set([customerUser.id, cleanerOneUser.id, cleanerTwoUser.id]), '4: start notifications must reach all recipients')

    result = await request('/bookings/completion-timing', auth.cleanerOne, 'POST', { bookingId: cashBooking.id, withinScheduledTime: false })
    assert.equal(result.response.status, 201, '5: cleaner must record No response')
    result = await request('/bookings/completion-timing', auth.cleanerTwo, 'POST', { bookingId: cashBooking.id, withinScheduledTime: true })
    assert.equal(result.response.status, 201, '5: another assigned cleaner must update response')
    await request('/bookings/completion-timing', auth.cleanerTwo, 'POST', { bookingId: cashBooking.id, withinScheduledTime: true })
    const alerts = await db.bookingPickupAlert.findMany({ where: { bookingId: cashBooking.id } })
    assert.equal(alerts.length, 1, '6: repeated Yes must not duplicate pickup alert')
    assert.equal(alerts[0].driverId, driver.id)
    assert.equal(alerts[0].priority, 'high')
    assert.equal(await db.notification.count({ where: { pickupAlertId: alerts[0].id, userId: driverUser.id } }), 1, '6: assigned driver must receive pickup notification')

    result = await request('/bookings/cleaner-complete', auth.otherCleaner, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 403, '18: unassigned cleaner must not complete')
    result = await request('/bookings/cleaner-complete', auth.cleanerTwo, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 200, '7: assigned cleaner must complete')
    booking = await db.booking.findUniqueOrThrow({ where: { id: cashBooking.id }, include: { statusHistory: true, assignments: true, invoices: true } })
    assert.equal(booking.status, 'completed')
    assert.equal(booking.invoices[0].paidAmount, 0, '19: completion must not pay invoice')
    assert.ok(booking.assignments.every(item => item.completedAt))
    notices = await db.notification.findMany({ where: { statusHistoryId: booking.statusHistory.at(-1).id } })
    assert.deepEqual(new Set(notices.map(item => item.userId)), new Set([customerUser.id, cleanerOneUser.id, cleanerTwoUser.id]), '8: completion notifications must reach all recipients')

    result = await request('/bookings/payment-method', auth.driver, 'POST', { bookingId: cashBooking.id, method: 'cash' })
    assert.equal(result.response.status, 403, '18: driver must not select customer payment')
    result = await request('/bookings/payment-method', auth.customer, 'POST', { bookingId: cashBooking.id, method: 'cash' })
    assert.equal(result.response.status, 201, '9: customer must select cash')
    assert.equal(result.data.status, 'cash_selected')
    result = await request('/bookings/cleaner-cash', auth.otherCleaner, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 403, '18: unassigned cleaner must not receive cash')
    result = await request('/bookings/cleaner-cash', auth.cleanerOne, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 200, '10: assigned cleaner must record cash')
    result = await request('/bookings/cleaner-cash', auth.cleanerOne, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 400, '11: duplicate cash receipt must be rejected')
    const cashPayments = await db.payment.findMany({ where: { invoice: { bookingId: cashBooking.id }, method: 'cash' } })
    assert.equal(cashPayments.length, 1)
    assert.equal(cashPayments[0].receivedBy, cleanerOneUser.id)
    assert.equal(cashPayments[0].status, 'verified')

    result = await request('/bookings/rate', auth.admin, 'POST', { bookingId: cashBooking.id, overallRating: 5, ratings: [{ employeeId: cleanerOne.id, rating: 5 }, { employeeId: cleanerTwo.id, rating: 4 }] })
    assert.equal(result.response.status, 403, '18: admin must not submit customer rating')
    result = await request('/bookings/rate', auth.customer, 'POST', { bookingId: cashBooking.id, overallRating: 5, overallComment: 'Excellent', ratings: [{ employeeId: cleanerOne.id, rating: 5 }, { employeeId: cleanerTwo.id, rating: 4 }] })
    assert.equal(result.response.status, 200, '16: customer must submit rating')
    result = await request('/bookings/rate', auth.customer, 'POST', { bookingId: cashBooking.id, overallRating: 5, ratings: [{ employeeId: cleanerOne.id, rating: 5 }, { employeeId: cleanerTwo.id, rating: 5 }] })
    assert.equal(result.response.status, 400, '16: duplicate rating must be rejected')
    const ratedAssignments = await db.assignment.findMany({ where: { bookingId: cashBooking.id }, orderBy: { employeeId: 'asc' } })
    assert.deepEqual(new Set(ratedAssignments.map(item => item.customerRating)), new Set([4, 5]), '17: every assigned cleaner retains an individual rating')

    const bankBooking = await makeBooking(`WF-BANK-${suffix}`, 'completed')
    result = await request('/company-bank-accounts', auth.admin, 'POST', { accountTitle: 'Workflow Account', bankName: 'Test Bank', accountNumber: `123456${Date.now()}`, currency: 'AED', instructions: 'Use booking reference', displayOrder: 1, isActive: true, isDefault: true })
    assert.equal(result.response.status, 201)
    const account = result.data
    result = await request('/company-bank-accounts', auth.customer)
    assert.equal(result.response.status, 200)
    assert.equal(result.data.accounts[0].id, account.id, '13: customer must see active account')
    assert.equal('createdBy' in result.data.accounts[0], false, '13: internal account audit fields must stay private')
    result = await request('/bookings/payment-method', auth.customer, 'POST', { bookingId: bankBooking.id, method: 'bank_transfer' })
    assert.equal(result.response.status, 201, '12: customer must select bank transfer')
    const proofUrl = `https://res.cloudinary.com/workflow-validation/image/upload/khobra/${tenant.id}/payment-proofs/proof.png`
    result = await request('/bookings/bank-transfer', auth.customer, 'POST', { bookingId: bankBooking.id, companyBankAccountId: account.id, referenceNo: `REJECT-${suffix}`, customerBankName: 'Customer Bank', accountHolderName: 'Customer', transferDate: new Date().toISOString(), transferAmount: 200, proofUrl })
    assert.equal(result.response.status, 201, `14: valid bank transfer must submit (${result.data.error || ''})`)
    result = await request('/bookings/bank-transfer', auth.admin, 'PUT', { paymentId: result.data.id, decision: 'reject', remarks: 'Validation rejection' })
    assert.equal(result.response.status, 200, '15: admin must reject transfer')
    assert.equal(result.data.status, 'rejected')
    await request('/bookings/payment-method', auth.customer, 'POST', { bookingId: bankBooking.id, method: 'bank_transfer' })
    result = await request('/bookings/bank-transfer', auth.customer, 'POST', { bookingId: bankBooking.id, companyBankAccountId: account.id, referenceNo: `APPROVE-${suffix}`, customerBankName: 'Customer Bank', accountHolderName: 'Customer', transferDate: new Date().toISOString(), transferAmount: 200, proofUrl })
    assert.equal(result.response.status, 201)
    result = await request('/bookings/bank-transfer', auth.admin, 'PUT', { paymentId: result.data.id, decision: 'approve', remarks: 'Verified' })
    assert.equal(result.response.status, 200, '15: admin must approve transfer')
    assert.equal(result.data.status, 'verified')

    const finalCash = await db.booking.findUniqueOrThrow({ where: { id: cashBooking.id }, include: { invoices: true, pickupAlerts: true, rating: true, statusHistory: true } })
    assert.equal(finalCash.status, 'completed')
    assert.equal(finalCash.invoices[0].status, 'paid')
    assert.equal(finalCash.pickupAlerts.length, 1)
    assert.ok(finalCash.rating)
    assert.ok(finalCash.statusHistory.length >= 3, '20: operational actions must remain in status history')
    const finalBank = await db.booking.findUniqueOrThrow({ where: { id: bankBooking.id }, include: { invoices: { include: { payments: true } } } })
    assert.equal(finalBank.status, 'completed', '19: payment must not mutate booking status')
    assert.equal(finalBank.invoices[0].status, 'paid')
    assert.deepEqual(new Set(finalBank.invoices[0].payments.map(item => item.status)), new Set(['rejected', 'verified']), '20: payment decisions must retain audit records')
  } finally {
    await db.notification.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.bookingRating.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.bookingPickupAlert.deleteMany({ where: { bookingId: { in: ids.bookingIds } } })
    await db.bookingCompletionTimingResponse.deleteMany({ where: { bookingId: { in: ids.bookingIds } } })
    await db.payment.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.invoice.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.bookingStatusHistory.deleteMany({ where: { bookingId: { in: ids.bookingIds } } })
    await db.assignment.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.booking.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.service.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.appSettings.deleteMany({ where: { key: `company_bank_accounts_${ids.tenantId}` } })
    await db.employee.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.driver.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.customer.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.user.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.tenant.delete({ where: { id: ids.tenantId } })
    await db.$disconnect()
  }
})
