import { NextRequest, NextResponse } from 'next/server'
import { calendarDayRange, zonedDayRange } from '@repo/core'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const DAY = 86_400_000
const money = (value: unknown) => Number(value || 0)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: auth.session.tenantId }, select: { timezone: true, currency: true } })
    const params = req.nextUrl.searchParams
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tenant.timezone }).format(new Date())
    const defaultFrom = new Date(`${today}T00:00:00Z`)
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29)
    const from = params.get('from') || defaultFrom.toISOString().slice(0, 10)
    const to = params.get('to') || today
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return NextResponse.json({ error: 'Use a valid date range' }, { status: 400 })
    }
    const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1
    if (days > 366) return NextResponse.json({ error: 'Report range cannot exceed 366 days' }, { status: 400 })

    const previousToDate = new Date(`${from}T00:00:00Z`)
    previousToDate.setUTCDate(previousToDate.getUTCDate() - 1)
    const previousFromDate = new Date(previousToDate)
    previousFromDate.setUTCDate(previousFromDate.getUTCDate() - days + 1)
    const previousFrom = previousFromDate.toISOString().slice(0, 10)
    const previousTo = previousToDate.toISOString().slice(0, 10)

    const bookingStart = calendarDayRange(previousFrom, tenant.timezone).start
    const bookingEnd = calendarDayRange(to, tenant.timezone).end
    const eventStart = zonedDayRange(previousFrom, tenant.timezone).start
    const eventEnd = zonedDayRange(to, tenant.timezone).end

    const [bookings, payments, businessExpenses, driverExpenses, payroll, invoices, complaints, reservations] = await Promise.all([
      db.booking.findMany({
        where: { tenantId: auth.session.tenantId, deletedAt: null, scheduledDate: { gte: bookingStart, lt: bookingEnd } },
        select: {
          customerId: true, status: true, scheduledDate: true, startTime: true, duration: true, netAmount: true, area: true,
          customer: { select: { area: true } }, service: { select: { name: true } },
          items: { select: { service: { select: { name: true } }, totalAmount: true, includesMaterials: true } },
          assignments: { select: { actualHours: true, customerRating: true, employee: { select: { user: { select: { name: true } } } } } },
        },
      }),
      db.payment.findMany({
        where: { tenantId: auth.session.tenantId, status: { in: ['paid', 'verified'] }, OR: [
          { receivedAt: { gte: eventStart, lt: eventEnd } },
          { receivedAt: null, verifiedAt: { gte: eventStart, lt: eventEnd } },
          { receivedAt: null, verifiedAt: null, createdAt: { gte: eventStart, lt: eventEnd } },
        ] },
        select: { amount: true, method: true, receivedAt: true, verifiedAt: true, createdAt: true },
      }),
      db.businessExpense.findMany({ where: { tenantId: auth.session.tenantId, expenseDate: { gte: eventStart, lt: eventEnd } }, select: { amount: true, category: true, expenseDate: true } }),
      db.driverExpense.findMany({ where: { tenantId: auth.session.tenantId, status: 'approved', expenseDate: { gte: eventStart, lt: eventEnd } }, select: { amount: true, category: true, expenseDate: true } }),
      db.payrollRecord.findMany({ where: { tenantId: auth.session.tenantId, status: 'paid', paidAt: { gte: eventStart, lt: eventEnd } }, select: { netSalary: true, paidAt: true } }),
      db.invoice.findMany({ where: { tenantId: auth.session.tenantId, issuedAt: { gte: eventStart, lt: eventEnd } }, select: { totalAmount: true, paidAmount: true, issuedAt: true } }),
      db.complaint.findMany({ where: { tenantId: auth.session.tenantId, deletedAt: null, createdAt: { gte: eventStart, lt: eventEnd } }, select: { status: true, createdAt: true, resolvedAt: true } }),
      db.bookingMaterialReservation.findMany({ where: { booking: { tenantId: auth.session.tenantId, scheduledDate: { gte: bookingStart, lt: bookingEnd } } }, select: { status: true, requiredQuantity: true, unitCost: true, inventoryItem: { select: { name: true } }, booking: { select: { scheduledDate: true } } } }),
    ])

    const dateKey = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tenant.timezone }).format(value)
    const paymentDate = (item: typeof payments[number]) => item.receivedAt || item.verifiedAt || item.createdAt
    const inPeriod = (value: Date, start: string, end: string) => { const key = dateKey(value); return key >= start && key <= end }
    const change = (current: number, previous: number) => previous ? Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10 : current ? null : 0

    const summarize = (start: string, end: string) => {
      const scopedBookings = bookings.filter(item => inPeriod(item.scheduledDate, start, end))
      const scopedPayments = payments.filter(item => inPeriod(paymentDate(item), start, end))
      const scopedBusiness = businessExpenses.filter(item => inPeriod(item.expenseDate, start, end))
      const scopedDriver = driverExpenses.filter(item => inPeriod(item.expenseDate, start, end))
      const scopedPayroll = payroll.filter(item => item.paidAt && inPeriod(item.paidAt, start, end))
      const scopedInvoices = invoices.filter(item => item.issuedAt && inPeriod(item.issuedAt, start, end))
      const completed = scopedBookings.filter(item => item.status === 'completed').length
      const cancelled = scopedBookings.filter(item => item.status === 'cancelled').length
      const noShow = scopedBookings.filter(item => item.status === 'no_show').length
      const actionable = scopedBookings.length - cancelled - noShow
      const revenue = scopedPayments.reduce((sum, item) => sum + money(item.amount), 0)
      const expenses = scopedBusiness.reduce((sum, item) => sum + money(item.amount), 0) + scopedDriver.reduce((sum, item) => sum + money(item.amount), 0) + scopedPayroll.reduce((sum, item) => sum + money(item.netSalary), 0)
      const bookedValue = scopedBookings.filter(item => !['cancelled', 'no_show'].includes(item.status)).reduce((sum, item) => sum + money(item.netAmount), 0)
      const invoiced = scopedInvoices.reduce((sum, item) => sum + money(item.totalAmount), 0)
      const invoicePaid = scopedInvoices.reduce((sum, item) => sum + money(item.paidAmount), 0)
      const customers = new Set(scopedBookings.map(item => item.customerId))
      const customerCounts = scopedBookings.reduce<Record<string, number>>((all, item) => { all[item.customerId] = (all[item.customerId] || 0) + 1; return all }, {})
      return {
        revenue, expenses, netCashFlow: revenue - expenses, bookedValue, bookings: scopedBookings.length, completed, cancelled, noShow,
        completionRate: actionable ? Math.round((completed / actionable) * 100) : 0,
        uniqueCustomers: customers.size, repeatCustomers: Object.values(customerCounts).filter(count => count > 1).length,
        averageBookingValue: actionable ? bookedValue / actionable : 0,
        invoiced, outstanding: Math.max(0, invoiced - invoicePaid), collectionRate: invoiced ? Math.round((invoicePaid / invoiced) * 100) : 0,
      }
    }

    const current = summarize(from, to)
    const previous = summarize(previousFrom, previousTo)
    const currentBookings = bookings.filter(item => inPeriod(item.scheduledDate, from, to))
    const currentPayments = payments.filter(item => inPeriod(paymentDate(item), from, to))
    const currentBusiness = businessExpenses.filter(item => inPeriod(item.expenseDate, from, to))
    const currentDriver = driverExpenses.filter(item => inPeriod(item.expenseDate, from, to))
    const currentPayroll = payroll.filter(item => item.paidAt && inPeriod(item.paidAt, from, to))

    const series = Array.from({ length: days }, (_, index) => {
      const date = new Date(`${from}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + index)
      const key = date.toISOString().slice(0, 10)
      return {
        date: key,
        bookings: currentBookings.filter(item => dateKey(item.scheduledDate) === key).length,
        completed: currentBookings.filter(item => dateKey(item.scheduledDate) === key && item.status === 'completed').length,
        revenue: currentPayments.filter(item => dateKey(paymentDate(item)) === key).reduce((sum, item) => sum + money(item.amount), 0),
        expenses: currentBusiness.filter(item => dateKey(item.expenseDate) === key).reduce((sum, item) => sum + money(item.amount), 0)
          + currentDriver.filter(item => dateKey(item.expenseDate) === key).reduce((sum, item) => sum + money(item.amount), 0)
          + currentPayroll.filter(item => item.paidAt && dateKey(item.paidAt) === key).reduce((sum, item) => sum + money(item.netSalary), 0),
      }
    })

    const group = <T,>(items: T[], keyOf: (item: T) => string, valueOf: (item: T) => number = () => 1) => Object.entries(items.reduce<Record<string, number>>((all, item) => {
      const key = keyOf(item) || 'Unknown'; all[key] = (all[key] || 0) + valueOf(item); return all
    }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    const serviceLines = currentBookings.flatMap(booking => (booking.items.length ? booking.items : [{ service: booking.service, totalAmount: booking.netAmount, includesMaterials: false }]).map(item => ({ ...item, booking })))
    const services = group(serviceLines, line => line.service?.name || 'Other').map(item => {
      const scoped = serviceLines.filter(line => (line.service?.name || 'Other') === item.name)
      return { name: item.name, bookings: scoped.length, bookedValue: scoped.reduce((sum, line) => sum + money(line.totalAmount), 0), completionRate: Math.round((scoped.filter(line => line.booking.status === 'completed').length / scoped.length) * 100), withMaterials: scoped.filter(line => line.includesMaterials).length }
    }).slice(0, 8)
    const materialOperations = group(reservations.filter(item => inPeriod(item.booking.scheduledDate, from, to)), item => item.inventoryItem.name, item => item.requiredQuantity).map(item => {
      const scoped = reservations.filter(reservation => reservation.inventoryItem.name === item.name && inPeriod(reservation.booking.scheduledDate, from, to))
      return { name: item.name, reserved: scoped.filter(item => item.status === 'reserved').reduce((sum, item) => sum + item.requiredQuantity, 0), consumed: scoped.filter(item => item.status === 'consumed').reduce((sum, item) => sum + item.requiredQuantity, 0), released: scoped.filter(item => item.status === 'released').reduce((sum, item) => sum + item.requiredQuantity, 0), estimatedCost: scoped.reduce((sum, item) => sum + item.requiredQuantity * money(item.unitCost), 0) }
    })
    const statuses = group(currentBookings, item => item.status)
    const paymentMethods = group(currentPayments, item => item.method, item => money(item.amount))
    const areas = group(currentBookings, item => item.area || item.customer.area || 'Unspecified').slice(0, 8)
    const expenseCategories = group([
      ...currentBusiness.map(item => ({ category: item.category, amount: money(item.amount) })),
      ...currentDriver.map(item => ({ category: `Driver: ${item.category}`, amount: money(item.amount) })),
      ...currentPayroll.map(item => ({ category: 'Payroll', amount: money(item.netSalary) })),
    ], item => item.category, item => item.amount).slice(0, 8)
    const weekdays = group(currentBookings, item => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tenant.timezone }).format(item.scheduledDate))
    const peakHours = group(currentBookings, item => `${item.startTime.slice(0, 2)}:00`).slice(0, 8).sort((a, b) => a.name.localeCompare(b.name))

    const staffMap = new Map<string, { name: string; assignments: number; completed: number; hours: number; ratings: number[] }>()
    currentBookings.forEach(booking => booking.assignments.forEach(assignment => {
      const name = assignment.employee.user.name
      const item = staffMap.get(name) || { name, assignments: 0, completed: 0, hours: 0, ratings: [] }
      item.assignments++; if (booking.status === 'completed') item.completed++
      item.hours += assignment.actualHours || booking.duration || 0
      if (assignment.customerRating) item.ratings.push(assignment.customerRating)
      staffMap.set(name, item)
    }))
    const staff = [...staffMap.values()].map(item => ({ ...item, completionRate: Math.round((item.completed / item.assignments) * 100), averageRating: item.ratings.length ? item.ratings.reduce((a, b) => a + b, 0) / item.ratings.length : null })).sort((a, b) => b.completed - a.completed).slice(0, 10)
    const currentComplaints = complaints.filter(item => inPeriod(item.createdAt, from, to))
    const resolvedComplaints = currentComplaints.filter(item => ['resolved', 'closed'].includes(item.status))

    return NextResponse.json({
      period: { from, to, days, previousFrom, previousTo }, currency: tenant.currency,
      summary: { ...current, changes: { revenue: change(current.revenue, previous.revenue), expenses: change(current.expenses, previous.expenses), netCashFlow: change(current.netCashFlow, previous.netCashFlow), bookings: change(current.bookings, previous.bookings), completed: change(current.completed, previous.completed), customers: change(current.uniqueCustomers, previous.uniqueCustomers) } },
      series, statuses, paymentMethods, services, materialOperations, areas, expenseCategories, weekdays, peakHours, staff,
      serviceQuality: { complaints: currentComplaints.length, complaintResolutionRate: currentComplaints.length ? Math.round((resolvedComplaints.length / currentComplaints.length) * 100) : 0, averageResolutionHours: resolvedComplaints.length ? Math.round(resolvedComplaints.reduce((sum, item) => sum + ((item.resolvedAt?.getTime() || item.createdAt.getTime()) - item.createdAt.getTime()) / 3_600_000, 0) / resolvedComplaints.length) : 0 },
    })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to build reports' })
  }
}
