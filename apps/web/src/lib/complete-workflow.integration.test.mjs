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
const { verifyPassword } = await import('../../../../packages/db/src/password.ts')
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
  const tenant = await db.tenant.create({ data: { name: 'Workflow Validation', slug: `workflow-${suffix}`, taxRate: 0.05 } })
  const ids = { tenantId: tenant.id, bookingIds: [], foreignTenantId: null }

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
      db.service.create({ data: { tenantId: tenant.id, name: 'Workflow Cleaning', baseRate: 100, withMaterialsRate: 130 } }),
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

    const variantDate = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10)
    const variantResult = await request('/bookings', auth.admin, 'POST', { customerId: customer.id, serviceId: service.id, serviceIds: [service.id], serviceOptions: [{ serviceId: service.id, withMaterials: true }], scheduledDate: variantDate, startDate: variantDate, endDate: variantDate, startTime: '09:00', endTime: '11:00', employeeCount: 1, bookingType: 'one_time', address: 'Villa 10', city: 'Dubai', area: 'Marina' })
    assert.equal(variantResult.response.status, 201, `Admin must create a with-materials booking: ${JSON.stringify(variantResult.data)}`)
    ids.bookingIds.push(variantResult.data.id)
    assert.equal(Number(variantResult.data.hourlyRate), 130, 'Server must use the configured with-materials rate')
    assert.equal(Number(variantResult.data.netAmount), 273, 'Server must calculate the selected variant, duration, cleaner count, and tax')
    assert.equal(variantResult.data.items[0].includesMaterials, true, 'Booking line must preserve the selected materials variant')

    let scoped = await request('/bookings', auth.cleanerOne)
    assert.equal(scoped.response.status, 200)
    assert.deepEqual(scoped.data.map(item => item.id), [cashBooking.id], 'Cleaner must see only assigned bookings')
    assert.deepEqual(scoped.data[0].assignments.map(item => item.employeeId), [cleanerOne.id], 'Cleaner must not see other cleaner assignments')
    scoped = await request('/bookings', auth.otherCleaner)
    assert.deepEqual(scoped.data, [], 'Unassigned cleaner must not see the booking')

    let issue = await request('/complaints', auth.otherCleaner, 'POST', { bookingId: cashBooking.id, description: 'Customer access issue', category: 'Customer Issue' })
    assert.equal(issue.response.status, 403, 'Unassigned cleaner must not report against a booking')
    issue = await request('/complaints', auth.cleanerOne, 'POST', { bookingId: cashBooking.id, customerId: 'forged-customer', description: 'Customer access issue', category: 'Customer Issue' })
    assert.equal(issue.response.status, 201, 'Assigned cleaner must report a customer issue')
    assert.equal(issue.data.customerId, customer.id, 'Customer must be derived from the assigned booking')
    scoped = await request('/complaints', auth.cleanerOne)
    assert.deepEqual(scoped.data.map(item => item.id), [issue.data.id], 'Cleaner must see issues for assigned bookings only')
    scoped = await request('/complaints', auth.otherCleaner)
    assert.deepEqual(scoped.data, [], 'Cleaner must not see another cleaner booking issue')
    assert.equal((await request('/complaints', auth.cleanerOne, 'PUT', { id: issue.data.id, status: 'resolved' })).response.status, 403, 'Cleaner must not resolve complaints')
    assert.equal((await request(`/complaints?id=${issue.data.id}`, auth.cleanerOne, 'DELETE')).response.status, 403, 'Cleaner must not delete complaints')

    assert.equal((await request('/customers', auth.cleanerOne)).response.status, 403, 'Cleaner must not access the customer directory')
    let attendance = await request('/attendance', auth.cleanerOne, 'POST', { employeeId: otherCleaner.id, date: new Date().toISOString(), clockIn: new Date().toISOString(), status: 'present' })
    assert.equal(attendance.response.status, 201)
    assert.equal(attendance.data.employeeId, cleanerOne.id, 'Cleaner attendance identity must come from the session')
    assert.deepEqual((await request('/attendance', auth.otherCleaner)).data, [], 'Cleaner must not see another cleaner attendance')
    assert.equal((await request('/attendance', auth.otherCleaner, 'PUT', { id: attendance.data.id, clockOut: new Date().toISOString() })).response.status, 403, 'Cleaner must not edit another cleaner attendance')
    assert.equal((await request(`/attendance?id=${attendance.data.id}`, auth.cleanerOne, 'DELETE')).response.status, 403, 'Cleaner must not delete attendance')

    const leave = await request('/leave', auth.cleanerOne, 'POST', { employeeId: otherCleaner.id, startDate: new Date().toISOString(), endDate: new Date().toISOString(), type: 'Annual', days: 1 })
    assert.equal(leave.response.status, 201)
    assert.equal(leave.data.employeeId, cleanerOne.id, 'Cleaner leave identity must come from the session')
    assert.deepEqual((await request('/leave', auth.otherCleaner)).data, [], 'Cleaner must not see another cleaner leave')
    assert.equal((await request('/leave', auth.cleanerOne, 'PUT', { id: leave.data.id, status: 'approved' })).response.status, 403, 'Cleaner must not approve leave')

    scoped = await request('/dashboard', auth.cleanerOne)
    assert.equal(scoped.data.stats.totalBookings, 1, 'Cleaner dashboard must count assigned bookings only')
    assert.equal(scoped.data.recentBookings[0].id, cashBooking.id)
    assert.deepEqual(scoped.data.recentBookings[0].assignments.map(item => item.employeeId), [cleanerOne.id], 'Cleaner dashboard must hide other assignments')
    assert.equal((await request('/dashboard', auth.otherCleaner)).data.stats.totalBookings, 0, 'Unassigned cleaner dashboard must not expose tenant bookings')

    scoped = await request('/bookings', auth.driver)
    assert.deepEqual(scoped.data.map(item => item.id), [cashBooking.id], 'Driver must see only assigned bookings')
    assert.deepEqual((await request('/bookings', auth.otherDriver)).data, [], 'Unassigned driver must not see the booking')
    assert.deepEqual((await request('/drivers', auth.driver)).data.map(item => item.id), [driver.id], 'Driver directory must expose only the signed-in driver')

    const assignedTrip = await db.trip.create({ data: { tenantId: tenant.id, driverId: driver.id, date: new Date(Date.now() + 86_400_000), stops: { create: [{ type: 'pickup', address: 'Cleaner accommodation' }, { type: 'dropoff', address: 'Customer villa' }] } } })
    await db.trip.create({ data: { tenantId: tenant.id, driverId: otherDriver.id, date: new Date(Date.now() + 86_400_000), stops: { create: [{ type: 'pickup', address: 'Other route' }] } } })
    scoped = await request('/trips', auth.driver)
    assert.deepEqual(scoped.data.map(item => item.id), [assignedTrip.id], 'Driver must see only assigned trips and stops')
    assert.equal(scoped.data[0].stops.length, 2)
    assert.equal((await request('/trips', auth.otherDriver, 'PUT', { id: assignedTrip.id, status: 'in_progress' })).response.status, 403, 'Unassigned driver must not update a trip')
    assert.equal((await request('/trips', auth.driver, 'PUT', { id: assignedTrip.id, date: new Date().toISOString() })).response.status, 403, 'Driver must not reschedule a trip')
    assert.equal((await request('/trips', auth.driver, 'PUT', { id: assignedTrip.id, status: 'in_progress' })).response.status, 200, 'Assigned driver must start a planned trip')

    const dispatchDate = new Date(Date.now() + 3 * 86_400_000)
    const createDispatchBooking = bookingNo => db.booking.create({ data: { tenantId: tenant.id, bookingNo, customerId: customer.id, serviceId: service.id, status: 'pending_assignment', scheduledDate: dispatchDate, startTime: '14:00', endTime: '16:00', duration: 2, employeeCount: 1, hourlyRate: 100, totalAmount: 200, netAmount: 200, address: 'Villa 10', city: 'Dubai', area: 'Marina' } })
    const dispatchBooking = await createDispatchBooking(`WF-DISPATCH-${suffix}`)
    ids.bookingIds.push(dispatchBooking.id)
    let dispatchAssignment = await request('/bookings/assign', auth.admin, 'POST', { bookingId: dispatchBooking.id, employeeIds: [otherCleaner.id], driverId: otherDriver.id })
    assert.equal(dispatchAssignment.response.status, 200, `Admin must assign cleaners and driver together: ${JSON.stringify(dispatchAssignment.data)}`)
    assert.equal(dispatchAssignment.data.driverId, otherDriver.id)
    const linkedStop = await db.tripStop.findUnique({ where: { bookingId: dispatchBooking.id }, include: { trip: true } })
    assert.equal(linkedStop?.trip.driverId, otherDriver.id, 'Driver assignment must create a booking-linked trip stop')

    const conflictingDispatchBooking = await createDispatchBooking(`WF-DISPATCH-CONFLICT-${suffix}`)
    ids.bookingIds.push(conflictingDispatchBooking.id)
    dispatchAssignment = await request('/bookings/assign', auth.admin, 'POST', { bookingId: conflictingDispatchBooking.id, employeeIds: [cleanerOne.id], driverId: otherDriver.id })
    assert.equal(dispatchAssignment.response.status, 400, 'A driver cannot be assigned to overlapping bookings')
    assert.match(dispatchAssignment.data.error, /already assigned/i)

    dispatchAssignment = await request('/bookings', auth.admin, 'PUT', { id: dispatchBooking.id, driverId: driver.id })
    assert.equal(dispatchAssignment.response.status, 200, 'Admin must reassign a booking before work starts')
    assert.equal(dispatchAssignment.data.driverId, driver.id)
    const movedStop = await db.tripStop.findUnique({ where: { bookingId: dispatchBooking.id }, include: { trip: true } })
    assert.equal(movedStop?.trip.driverId, driver.id, 'Reassignment must move the booking stop to the new driver trip')
    const assignmentNotices = await db.notification.findMany({ where: { deliveryKey: { startsWith: `booking-driver` }, message: { contains: dispatchBooking.bookingNo } } })
    assert.deepEqual(new Set(assignmentNotices.map(item => item.userId)), new Set([driverUser.id, otherDriverUser.id]), 'New and previous drivers must be notified')

    let expense = await request('/driver-expenses', auth.driver, 'POST', { driverId: otherDriver.id, tripId: assignedTrip.id, category: 'petrol', typeDetail: 'Special 95', amount: 75, expenseDate: new Date().toISOString(), notes: 'Route fuel' })
    assert.equal(expense.response.status, 201, 'Driver must add an expense')
    assert.equal(expense.data.driverId, driver.id, 'Expense driver identity must come from the session')
    assert.equal(expense.data.status, 'pending')
    assert.deepEqual((await request('/driver-expenses', auth.otherDriver)).data, [], 'Driver must not see another driver expenses')
    assert.equal((await request('/driver-expenses', auth.customer, 'POST', { category: 'petrol', amount: 10, expenseDate: new Date().toISOString() })).response.status, 403, 'Customer must not create driver expenses')
    expense = await request('/driver-expenses', auth.admin, 'PUT', { id: expense.data.id, decision: 'approved', remarks: 'Receipt checked' })
    assert.equal(expense.response.status, 200, 'Admin must approve a pending driver expense')
    assert.equal(expense.data.status, 'approved')
    assert.equal(expense.data.approvedBy, adminUser.id)
    assert.equal((await request('/driver-expenses', auth.admin, 'PUT', { id: expense.data.id, decision: 'rejected' })).response.status, 409, 'Reviewed expenses must not be decided twice')

    let businessExpense = await request('/business-expenses', auth.customer, 'POST', { category: 'other', description: 'Unauthorized', amount: 10, expenseDate: new Date().toISOString() })
    assert.equal(businessExpense.response.status, 403, 'Only Admin may record business expenses')
    businessExpense = await request('/business-expenses', auth.admin, 'POST', { category: 'cleaning_material', description: 'Cleaning chemicals', amount: 125, expenseDate: new Date().toISOString() })
    assert.equal(businessExpense.response.status, 201, 'Admin must record categorized business expenses')
    assert.equal(businessExpense.data.createdBy, adminUser.id)
    assert.deepEqual((await request('/business-expenses', auth.admin)).data.map(item => item.id), [businessExpense.data.id])
    if (process.env.SCOPE_ONLY === '1') return

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
    assert.ok(booking.assignments.every(item => item.startedAt), 'Starting work must start every assigned cleaner assignment for worked-hours reporting')
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
    const pickupNotifications = await db.notification.findMany({
      where: { pickupAlertId: alerts[0].id, userId: driverUser.id },
      select: { channel: true, deliveryKey: true },
    })
    assert.deepEqual(
      pickupNotifications.map(({ channel }) => channel).sort(),
      ['in_app', 'native_push', 'web_push'],
      '6: assigned driver must receive exactly one notification per supported channel',
    )
    assert.equal(new Set(pickupNotifications.map(({ deliveryKey }) => deliveryKey)).size, 1, '6: channel notifications must share one logical delivery key')

    result = await request('/bookings/cleaner-complete', auth.otherCleaner, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 403, '18: unassigned cleaner must not complete')
    result = await request('/bookings/cleaner-complete', auth.cleanerTwo, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 200, '7: assigned cleaner must complete')
    booking = await db.booking.findUniqueOrThrow({ where: { id: cashBooking.id }, include: { statusHistory: true, assignments: true, invoices: true } })
    assert.equal(booking.status, 'completed')
    assert.equal(Number(booking.invoices[0].paidAmount), 0, '19: completion must not pay invoice')
    const actualBillableHours = booking.assignments.reduce((sum, assignment) => sum + Number(assignment.actualHours || 0), 0)
    assert.equal(Number(booking.invoices[0].subtotal), actualBillableHours * 100, 'Completed invoice must use actual cleaner hours')
    assert.equal(Number(booking.invoices[0].taxAmount), Number(booking.invoices[0].subtotal) * 0.05, 'Invoice tax must use tenant tax rate')
    assert.equal(Number(booking.invoices[0].totalAmount), Number(booking.invoices[0].subtotal) + Number(booking.invoices[0].taxAmount), 'Invoice total must preserve its tax breakdown')
    const cashCollectible = Number(booking.invoices[0].totalAmount)
    assert.ok(booking.assignments.every(item => item.completedAt))
    notices = await db.notification.findMany({ where: { statusHistoryId: booking.statusHistory.at(-1).id } })
    assert.deepEqual(new Set(notices.map(item => item.userId)), new Set([customerUser.id, cleanerOneUser.id, cleanerTwoUser.id]), '8: completion notifications must reach all recipients')

    result = await request('/bookings/payment-method', auth.driver, 'POST', { bookingId: cashBooking.id, method: 'cash' })
    assert.equal(result.response.status, 403, '18: driver must not select customer payment')
    result = await request('/bookings/payment-method', auth.customer, 'POST', { bookingId: cashBooking.id, method: 'cash' })
    assert.equal(result.response.status, 201, '9: customer must select cash')
    assert.equal(result.data.status, 'cash_selected')
    let cashInvoice = await db.invoice.findFirstOrThrow({ where: { bookingId: cashBooking.id } })
    assert.equal(Number(cashInvoice.paidAmount), 0, 'Selecting cash must not create an inflow')
    assert.equal(cashInvoice.selectedPaymentMethod, 'cash')
    assert.equal(await db.payment.count({ where: { invoiceId: cashInvoice.id } }), 0, 'Selecting Pay Cash must not create a transaction')
    result = await request('/bookings/cleaner-cash', auth.otherCleaner, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 403, '18: unassigned cleaner must not receive cash')
    result = await request('/bookings/cleaner-cash', auth.cleanerOne, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 200, '10: assigned cleaner must record cash')
    result = await request('/bookings/cleaner-cash', auth.cleanerOne, 'POST', { bookingId: cashBooking.id })
    assert.equal(result.response.status, 400, '11: duplicate cash receipt must be rejected')
    const cashPayments = await db.payment.findMany({ where: { invoice: { bookingId: cashBooking.id }, method: 'cash' }, include: { invoice: true } })
    assert.equal(cashPayments.length, 1)
    assert.equal(cashPayments[0].invoice.bookingId, cashBooking.id)
    assert.equal(cashPayments[0].invoice.customerId, customer.id)
    assert.equal(cashPayments[0].receivedBy, cleanerOneUser.id)
    assert.equal(cashPayments[0].status, 'paid')
    assert.equal(cashPayments[0].reconciliationStatus, 'pending')
    assert.ok(cashPayments[0].receivedAt)
    assert.equal(cashPayments[0].verifiedAt, null)
    assert.equal(Number((await db.invoice.findFirstOrThrow({ where: { bookingId: cashBooking.id } })).paidAmount), cashCollectible, 'Cash receipt must add the inflow exactly once')
    result = await request('/dashboard', auth.admin)
    assert.equal(result.data.stats.cashInflow, cashCollectible, 'Pending-reconciliation cash must appear in cash inflow reporting')
    assert.equal(result.data.stats.bankInflow, 0)
    result = await request('/bookings/payment-method', auth.admin, 'PUT', { paymentId: cashPayments[0].id, remarks: 'Cash counted and reconciled' })
    assert.equal(result.response.status, 200, `Cash reconciliation failed: ${result.data.error || ''}`)
    assert.equal(result.data.status, 'verified')
    assert.equal(result.data.reconciliationStatus, 'reconciled')
    assert.equal(Number((await db.invoice.findFirstOrThrow({ where: { bookingId: cashBooking.id } })).paidAmount), cashCollectible, 'Cash reconciliation must not count the inflow twice')

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
    const proofUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/khobra/${tenant.id}/payment-proofs/proof.png`
    await db.uploadAsset.create({ data: { tenantId: tenant.id, userId: customerUser.id, url: proofUrl, publicId: `khobra/${tenant.id}/payment-proofs/proof`, purpose: 'payment-proofs', mimeType: 'image/png', size: 1024 } })
    result = await request('/bookings/bank-transfer', auth.customer, 'POST', { bookingId: bankBooking.id, companyBankAccountId: account.id, referenceNo: `REJECT-${suffix}`, customerBankName: 'Customer Bank', accountHolderName: 'Customer', transferDate: new Date().toISOString(), transferAmount: 200, proofUrl })
    assert.equal(result.response.status, 201, `14: valid bank transfer must submit (${result.data.error || ''})`)
    assert.equal(await db.payment.count({ where: { invoiceId: result.data.invoiceId, status: { in: ['paid', 'verified'] } } }), 0, 'Submitting transfer evidence must not create a confirmed transaction')
    result = await request('/bookings/bank-transfer', auth.admin, 'PUT', { paymentId: result.data.id, decision: 'reject', remarks: 'Validation rejection' })
    assert.equal(result.response.status, 200, '15: admin must reject transfer')
    assert.equal(result.data.status, 'rejected')
    assert.equal(Number((await db.invoice.findFirstOrThrow({ where: { bookingId: bankBooking.id } })).paidAmount), 0, 'Rejected submissions must not create bank inflow')
    assert.equal(await db.payment.count({ where: { invoiceId: result.data.invoiceId, status: { in: ['paid', 'verified'] } } }), 0, 'Rejected transfer must leave zero confirmed transactions')
    await request('/bookings/payment-method', auth.customer, 'POST', { bookingId: bankBooking.id, method: 'bank_transfer' })
    result = await request('/bookings/bank-transfer', auth.customer, 'POST', { bookingId: bankBooking.id, companyBankAccountId: account.id, referenceNo: `APPROVE-${suffix}`, customerBankName: 'Customer Bank', accountHolderName: 'Customer', transferDate: new Date().toISOString(), transferAmount: 200, proofUrl })
    assert.equal(result.response.status, 201)
    const approvedSubmission = result.data
    result = await request('/bookings/bank-transfer', auth.driver, 'PUT', { paymentId: approvedSubmission.id, decision: 'approve', remarks: 'Unauthorized' })
    assert.equal(result.response.status, 403, 'Unauthorized users cannot approve bank transactions')
    result = await request('/bookings/bank-transfer', auth.admin, 'PUT', { paymentId: approvedSubmission.id, decision: 'approve', remarks: 'Verified' })
    assert.equal(result.response.status, 200, '15: admin must approve transfer')
    assert.equal(result.data.status, 'paid')
    assert.equal(result.data.verifiedBy, adminUser.id)
    assert.ok(result.data.verifiedAt)
    assert.equal(result.data.referenceNo, approvedSubmission.referenceNo)
    assert.equal(result.data.proofUrl, proofUrl)
    assert.equal(result.data.companyBankAccountId, account.id)
    result = await request('/bookings/bank-transfer', auth.admin, 'PUT', { paymentId: approvedSubmission.id, decision: 'approve', remarks: 'Duplicate' })
    assert.equal(result.response.status, 400, 'Approved bank transfers must not create duplicate transactions')
    assert.equal(await db.payment.count({ where: { invoiceId: approvedSubmission.invoiceId, status: { in: ['paid', 'verified'] } } }), 1, 'Bank approval must create exactly one confirmed transaction')
    result = await request('/dashboard', auth.admin)
    assert.equal(result.data.stats.cashInflow, cashCollectible)
    assert.equal(result.data.stats.bankInflow, 200, 'Approved bank transfer must appear in bank inflow reporting')

    result = await request('/invoices', auth.admin, 'POST', { customerId: customer.id, totalAmount: 50, status: 'paid' })
    assert.equal(result.response.status, 400, 'Invoices cannot be marked paid without a transaction')
    result = await request('/invoices', auth.admin, 'POST', { customerId: customer.id, totalAmount: 50, status: 'issued', notes: 'Manual finance invoice' })
    assert.equal(result.response.status, 201, `Manual invoice creation failed: ${result.data.error || ''}`)
    const manualInvoice = result.data
    assert.equal(Number(manualInvoice.paidAmount), 0)
    result = await request('/payments', auth.customer, 'POST', { invoiceId: manualInvoice.id, amount: 1, method: 'cash', referenceNo: `UNAUTHORIZED-${suffix}` })
    assert.equal(result.response.status, 403, 'Unauthorized users cannot access generic transaction creation')
    result = await request('/payments', auth.admin, 'POST', { invoiceId: manualInvoice.id, amount: 20, method: 'cash', referenceNo: `MANUAL-1-${suffix}` })
    assert.equal(result.response.status, 405, 'Admin must use the approved cash or bank workflow')
    assert.equal(await db.payment.count({ where: { invoiceId: manualInvoice.id } }), 0)

    const foreignTenant = await db.tenant.create({ data: { name: 'Foreign Workflow', slug: `foreign-${suffix}` } })
    ids.foreignTenantId = foreignTenant.id
    const foreignUser = await db.user.create({ data: { tenantId: foreignTenant.id, email: `foreign-${suffix}@test.local`, name: 'Foreign Customer', role: 'customer' } })
    const foreignAdmin = await db.user.create({ data: { tenantId: foreignTenant.id, email: `foreign-admin-${suffix}@test.local`, name: 'Foreign Admin', role: 'admin' } })
    const foreignAdminToken = createSessionToken({ userId: foreignAdmin.id, tenantId: foreignTenant.id, email: foreignAdmin.email, role: foreignAdmin.role, name: foreignAdmin.name })
    const foreignCustomer = await db.customer.create({ data: { tenantId: foreignTenant.id, userId: foreignUser.id } })
    const foreignInvoice = await db.invoice.create({ data: { tenantId: foreignTenant.id, customerId: foreignCustomer.id, invoiceNo: `FOREIGN-${suffix}`, subtotal: 10, totalAmount: 10 } })
    const mainCategory = await request('/services/categories', auth.admin, 'POST', { name: `Main ${suffix}`, description: 'Main tenant only', color: 'emerald' })
    assert.equal(mainCategory.response.status, 201)
    assert.equal((await request('/services/categories', foreignAdminToken)).data.some(item => item.id === mainCategory.data.id), false, 'Service categories must not cross tenant boundaries')
    const foreignCategory = await request('/services/categories', foreignAdminToken, 'POST', { name: `Foreign ${suffix}`, description: 'Foreign tenant only', color: 'teal' })
    assert.equal(foreignCategory.response.status, 201)
    assert.equal((await request('/services/categories', auth.admin)).data.some(item => item.id === foreignCategory.data.id), false, 'Foreign categories must not appear in the main tenant')
    result = await request('/payments', auth.admin, 'POST', { invoiceId: foreignInvoice.id, amount: 10, method: 'cash', referenceNo: `FOREIGN-${suffix}` })
    assert.equal(result.response.status, 405, 'The disabled generic endpoint cannot bypass tenant-safe workflows')
    result = await request('/dashboard', auth.admin)
    assert.equal(result.response.status, 200)
    assert.equal(result.data.stats.totalRevenue, cashCollectible + 200, 'Revenue must equal confirmed cash and bank transaction amounts')
    assert.equal(result.data.stats.cashOutflow, 200, 'Cash flow must include approved driver and business expenses')
    assert.equal(result.data.stats.netCashFlow, result.data.stats.totalRevenue - 200, 'Net cash flow must subtract recorded outflows')
    assert.equal(result.data.stats.bookingStatusCounts.completed, 2, 'Dashboard status metrics must use actual grouped statuses')
    result = await request('/payments', auth.admin)
    assert.equal(result.response.status, 200)
    for (const transaction of result.data.filter(item => ['paid', 'verified'].includes(item.status))) {
      assert.equal(transaction.details.detailTotal, transaction.master.totalAmount, `Transaction ${transaction.master.transactionNumber} detail must match master`)
      assert.equal(transaction.master.bookingReference, transaction.invoice.booking?.bookingNo || null)
      assert.equal(transaction.master.customer, transaction.invoice.customer.user.name)
    }
    const bankTransaction = result.data.find(item => item.master.paymentReference === `APPROVE-${suffix}`)
    assert.equal(bankTransaction.master.paymentMethod, 'bank_transfer')
    assert.equal(bankTransaction.master.companyBankAccount.accountNumber, account.accountNumber)
    assert.equal(bankTransaction.bankTransferDetails.proofUrl, proofUrl)
    assert.equal(bankTransaction.approvalInformation.approvedBy, adminUser.name)
    assert.ok(bankTransaction.history.some(item => item.event === 'Bank transfer approved'))
    const cashTransaction = result.data.find(item => item.invoice.bookingId === cashBooking.id && item.method === 'cash')
    assert.equal(cashTransaction.master.cleanerCollectingCash, cleanerOneUser.name)
    assert.ok(cashTransaction.history.some(item => item.event === 'Cash received'))

    result = await request('/rbac', auth.admin, 'PATCH', { userId: otherCleanerUser.id })
    assert.equal(result.response.status, 200, 'Admin must be able to establish login credentials for a passwordless operational user')
    const resetUser = await db.user.findUniqueOrThrow({ where: { id: otherCleanerUser.id } })
    assert.ok(resetUser.passwordHash && verifyPassword(result.data.temporaryPassword, resetUser.passwordHash), 'Reset credential must authenticate against the persisted hash')

    assert.equal((await request('/auth/me', auth.otherDriver)).response.status, 200)
    assert.equal((await request('/auth/logout', auth.otherDriver, 'POST')).response.status, 200)
    const revokedSession = await request('/auth/me', auth.otherDriver)
    assert.equal(revokedSession.response.status, 200)
    assert.equal(revokedSession.data.authenticated, false, 'Logout must revoke the server session, not only clear the client token')

    await db.service.update({ where: { id: service.id }, data: { skills: 'specialist-only' } })
    const manualBookingDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
    result = await request('/bookings', auth.admin, 'POST', {
      customerId: customer.id,
      serviceId: service.id,
      serviceIds: [service.id],
      preferredEmployeeIds: [otherCleaner.id],
      employeeCount: 1,
      bookingType: 'one_time',
      scheduledDate: manualBookingDate,
      startTime: '10:00',
      endTime: '12:00',
      address: 'Villa 10',
      city: 'Dubai',
    })
    assert.equal(result.response.status, 201, `Cleaner availability must not depend on skills: ${JSON.stringify(result.data)}`)
    ids.bookingIds.push(result.data.id)
    assert.equal(result.data.createdBy, adminUser.id, 'Booking creator must be the authenticated user ID')
    assert.equal(result.data.assignments[0].employeeId, otherCleaner.id)

    const finalCash = await db.booking.findUniqueOrThrow({ where: { id: cashBooking.id }, include: { invoices: true, pickupAlerts: true, rating: true, statusHistory: true } })
    assert.equal(finalCash.status, 'completed')
    assert.equal(finalCash.invoices[0].status, 'paid')
    assert.equal(finalCash.pickupAlerts.length, 1)
    assert.ok(finalCash.rating)
    assert.ok(finalCash.statusHistory.length >= 3, '20: operational actions must remain in status history')
    assert.ok(finalCash.statusHistory.every(item => item.changedByUserId && ['driver', 'cleaner'].includes(item.changedByRole)), 'Every operational transition must retain a typed actor')
    const finalBank = await db.booking.findUniqueOrThrow({ where: { id: bankBooking.id }, include: { invoices: { include: { payments: true } } } })
    assert.equal(finalBank.status, 'completed', '19: payment must not mutate booking status')
    assert.equal(finalBank.invoices[0].status, 'paid')
    assert.deepEqual(new Set(finalBank.invoices[0].payments.map(item => item.status)), new Set(['rejected', 'paid']), '20: payment decisions must retain audit records')
  } finally {
    if (ids.foreignTenantId) {
      await db.appSettings.deleteMany({ where: { key: { startsWith: `${ids.foreignTenantId}:` } } })
      await db.invoice.deleteMany({ where: { tenantId: ids.foreignTenantId } })
      await db.customer.deleteMany({ where: { tenantId: ids.foreignTenantId } })
      await db.user.deleteMany({ where: { tenantId: ids.foreignTenantId } })
      await db.tenant.delete({ where: { id: ids.foreignTenantId } })
    }
    await db.notification.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.complaint.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.attendance.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.leaveRecord.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.driverExpense.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.businessExpense.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.bookingRating.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.bookingPickupAlert.deleteMany({ where: { bookingId: { in: ids.bookingIds } } })
    await db.bookingCompletionTimingResponse.deleteMany({ where: { bookingId: { in: ids.bookingIds } } })
    await db.payment.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.uploadAsset.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.companyBankAccount.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.invoice.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.bookingStatusHistory.deleteMany({ where: { bookingId: { in: ids.bookingIds } } })
    await db.assignment.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.booking.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.service.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.referenceSequence.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.appSettings.deleteMany({ where: { key: `company_bank_accounts_${ids.tenantId}` } })
    await db.appSettings.deleteMany({ where: { key: { startsWith: `${ids.tenantId}:` } } })
    await db.employee.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.tripStop.deleteMany({ where: { trip: { tenantId: ids.tenantId } } })
    await db.trip.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.driver.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.customer.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.user.deleteMany({ where: { tenantId: ids.tenantId } })
    await db.tenant.delete({ where: { id: ids.tenantId } })
    await db.$disconnect()
  }
})
