import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaBookingRepository } from '@repo/db'
import { CreateBookingSchema, UpdateBookingSchema, canCleanerStartWork, canDriverTransitionToOnTheWay, generateBookingOccurrenceDates, getPrimaryCustomerAddress, isBookingAtLeastHoursAhead } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const bookingRepository = new PrismaBookingRepository(db)

function bookingErrorResponse(error: unknown, fallback: string) {
  return apiErrorResponse(error, {
    fallback,
    conflict: 'This booking conflicts with an existing record. Refresh the page and try again.',
    relatedRecord: 'A selected customer, service, or cleaner record no longer exists. Refresh the page and try again.',
    missing: 'The booking or a related record was not found. Refresh the page and try again.',
    domainErrorStatus: 400,
  })
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findUnique({ where: { id: auth.session.tenantId } })
    if (!tenant) return NextResponse.json([])
    
    let bookings = await bookingRepository.findManyByTenant(tenant.id)
    if (auth.session.role === 'customer') {
      const customer = await db.customer.findFirst({ where: { tenantId: tenant.id, userId: auth.session.userId } })
      bookings = bookings.filter(booking => booking.customerId === customer?.id)
    } else if (auth.session.role === 'cleaner') {
      const cleaner = await db.employee.findFirst({ where: { tenantId: tenant.id, userId: auth.session.userId } })
      bookings = bookings
        .filter(booking => booking.assignments?.some(assignment => assignment.employeeId === cleaner?.id))
        .map(booking => ({ ...booking, assignments: booking.assignments?.filter(assignment => assignment.employeeId === cleaner?.id) }))
    } else if (auth.session.role === 'driver') {
      const driver = await db.driver.findFirst({ where: { tenantId: tenant.id, userId: auth.session.userId } })
      bookings = bookings.filter(booking => booking.driverId === driver?.id)
    }
    return NextResponse.json(bookings.map((booking: any) => {
      if (auth.session.role === 'admin') return { ...booking, currency: tenant.currency }
      const { materialReservations: _materialReservations, ...safe } = booking
      safe.customer = booking.customer ? { id: booking.customer.id, userId: booking.customer.userId, phone: booking.customer.phone, user: booking.customer.user } : null
      safe.driver = booking.driver ? { id: booking.driver.id, user: booking.driver.user } : null
      safe.materials = booking.materials?.map(({ inventoryItem: _inventoryItem, ...material }: any) => material)
      safe.assignments = booking.assignments?.map(({ id, employeeId, status, customerRating, employee }: any) => ({ id, employeeId, status, customerRating, employee: employee ? { id: employee.id, employeeCode: employee.employeeCode, user: employee.user } : null }))
      safe.completionTimingResponses = booking.completionTimingResponses?.map(({ id, bookingId, employeeId, withinScheduledTime, createdAt, employee }: any) => ({ id, bookingId, employeeId, withinScheduledTime, createdAt, employee: employee ? { id: employee.id, employeeCode: employee.employeeCode, user: employee.user } : null }))
      safe.pickupAlerts = []
      safe.rating = booking.rating ? { overallRating: booking.rating.overallRating, comment: booking.rating.comment, submittedAt: booking.rating.submittedAt } : null
      safe.statusHistory = booking.statusHistory?.map(({ id, previousStatus, newStatus, changedBy, changedByRole, reason, createdAt }: any) => ({ id, previousStatus, newStatus, changedBy, changedByRole, reason, createdAt }))
      delete safe.tenantId
      delete safe.createdBy
      delete safe.cancelledBy
      if (auth.session.role === 'driver') safe.invoices = []
      else safe.invoices = booking.invoices?.map((invoice: any) => ({
        id: invoice.id,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        selectedPaymentMethod: invoice.selectedPaymentMethod,
        paymentSelectedAt: invoice.paymentSelectedAt,
        payments: invoice.payments?.map(({ id, method, status, reconciliationStatus, receivedAt, verifiedAt, createdAt }: any) => ({ id, method, status, reconciliationStatus, receivedAt, verifiedAt, createdAt })),
      }))
      return { ...safe, currency: tenant.currency }
    }))
  } catch (error) {
    return bookingErrorResponse(error, 'Failed to fetch bookings')
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findUnique({ where: { id: auth.session.tenantId } })
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateBookingSchema.parse(body)
    if (auth.session.role === 'customer') {
      const tooSoon = generateBookingOccurrenceDates({
        ...validatedData,
        selectedDates: validatedData.selectedDates ? validatedData.selectedDates.filter((d): d is string | Date => Boolean(d)) : undefined,
      }).some(date => !isBookingAtLeastHoursAhead(date, validatedData.startTime, tenant.timezone || 'UTC'))
      if (tooSoon) return NextResponse.json({ error: 'Customer bookings must be scheduled at least two hours in advance' }, { status: 400 })
    }
    const customer = await db.customer.findFirst({ where: { id: validatedData.customerId, tenantId: tenant.id } })
    if (!customer || (auth.session.role === 'customer' && customer.userId !== auth.session.userId)) {
      return NextResponse.json({ error: 'Customer is not allowed to create this booking' }, { status: 403 })
    }
    if (auth.session.role === 'customer') {
      const primaryAddress = getPrimaryCustomerAddress(customer.addresses, customer.address)
      if (!primaryAddress) return NextResponse.json({ error: 'Add a primary address in Profile before booking', code: 'PRIMARY_ADDRESS_REQUIRED' }, { status: 409 })
      validatedData.address = primaryAddress
      const savedAddresses = Array.isArray(customer.addresses) ? customer.addresses : []
      const primary = savedAddresses[0] as { city?: unknown; area?: unknown; latitude?: unknown; longitude?: unknown } | undefined
      validatedData.city = typeof primary?.city === 'string' ? primary.city : customer.city || validatedData.city
      validatedData.area = typeof primary?.area === 'string' ? primary.area : customer.area || validatedData.area
      validatedData.latitude = typeof primary?.latitude === 'number' ? primary.latitude : undefined
      validatedData.longitude = typeof primary?.longitude === 'number' ? primary.longitude : undefined
    }
    
    const booking = await bookingRepository.create(tenant.id, validatedData, {
      userId: auth.session.userId,
      role: auth.session.role,
      name: auth.session.name,
    })
    
    broadcast('booking:created', { bookingNo: booking.bookingNo, status: 'pending', service: booking.service?.name }, auth.session.tenantId)
    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    return bookingErrorResponse(error, 'Failed to create booking')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    const body = await req.json()
    const validatedData = UpdateBookingSchema.parse(body)
    const booking = await db.booking.findUnique({ where: { id: validatedData.id }, include: { customer: true, assignments: { select: { employeeId: true } } } })
    if (!booking || booking.tenantId !== auth.session.tenantId) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    const role = auth.session.role
    let authorizedDriverId: string | undefined
    let authorizedEmployeeId: string | undefined
    if (validatedData.driverId !== undefined && role === 'admin' && validatedData.driverId !== null) {
      const driver = await db.driver.findFirst({ where: { id: validatedData.driverId, tenantId: booking.tenantId, status: { in: ['active', 'AVAILABLE'] } } })
      if (!driver) return NextResponse.json({ error: 'Select an active driver from this tenant' }, { status: 400 })
    }
    if (validatedData.status === 'on_the_way' && role !== 'driver')
      return NextResponse.json({ error: 'Only the assigned driver may change a Scheduled booking to On the Way' }, { status: 403 })
    if (validatedData.status === 'in_progress' && role !== 'cleaner')
      return NextResponse.json({ error: 'Only an assigned cleaner may start work on an On the Way booking' }, { status: 403 })
    if (validatedData.status === 'completed')
      return NextResponse.json({ error: 'Assigned cleaners must use Complete Booking to finish an In Progress booking' }, { status: 403 })
    if (role === 'customer') {
      if (booking.customer.userId !== auth.session.userId)
        return NextResponse.json({ error: 'Customers may only update their own bookings' }, { status: 403 })
      const isCancellation = validatedData.status === 'cancelled'
      if (validatedData.status && !isCancellation)
        return NextResponse.json({ error: 'Customers cannot change booking status' }, { status: 403 })
      if (!isCancellation) {
        if (!['pending_assignment', 'pending', 'assigned', 'scheduled', 'confirmed'].includes(booking.status))
          return NextResponse.json({ error: `Booking details cannot be edited while booking is '${booking.status}'` }, { status: 400 })
      }
    }
    if (role === 'driver') {
      const driver = await db.driver.findFirst({ where: { tenantId: booking.tenantId, userId: auth.session.userId } })
      if (!driver || booking.driverId !== driver.id)
        return NextResponse.json({ error: 'Only the driver assigned to this booking may update its status' }, { status: 403 })
      authorizedDriverId = driver.id
      if (!canDriverTransitionToOnTheWay(booking.status, validatedData.status, booking.driverId, driver.id))
        return NextResponse.json({ error: 'Drivers may only change Scheduled bookings to On the Way' }, { status: 403 })
    }
    if (role === 'cleaner') {
      const cleaner = await db.employee.findFirst({ where: { tenantId: booking.tenantId, userId: auth.session.userId } })
      const assignedCleanerIds = booking.assignments.map(assignment => assignment.employeeId)
      if (!cleaner || !assignedCleanerIds.includes(cleaner.id)) return NextResponse.json({ error: 'Only a cleaner assigned to this booking may update its status' }, { status: 403 })
      const allowed = canCleanerStartWork(booking.status, validatedData.status, assignedCleanerIds, cleaner.id)
      if (!allowed) return NextResponse.json({ error: 'Start Work is only available when an assigned booking is On the Way' }, { status: 403 })
      authorizedEmployeeId = cleaner.id
    }
    if (!['admin', 'customer', 'driver', 'cleaner'].includes(role))
      return NextResponse.json({ error: 'You are not authorized to update booking status' }, { status: 403 })
    
    const updateData = role === 'admin'
      ? validatedData
      : role === 'customer'
        ? validatedData.status === 'cancelled'
          ? { id: validatedData.id, status: validatedData.status, cancellationReason: validatedData.cancellationReason }
          : {
              id: validatedData.id,
              serviceId: validatedData.serviceId,
              serviceIds: validatedData.serviceIds,
              serviceOptions: validatedData.serviceOptions,
              scheduledDate: validatedData.scheduledDate,
              startTime: validatedData.startTime,
              endTime: validatedData.endTime,
              employeeCount: validatedData.employeeCount,
              address: validatedData.address,
              city: validatedData.city,
              area: validatedData.area,
              latitude: validatedData.latitude,
              longitude: validatedData.longitude,
              notes: validatedData.notes,
            }
        : { id: validatedData.id, status: validatedData.status }
    const updated = await bookingRepository.update(auth.session.tenantId, updateData.id, updateData, { userId: auth.session.userId, role, name: auth.session.name }, authorizedDriverId, authorizedEmployeeId)
    
    broadcast('booking:updated', { bookingNo: updated.bookingNo, status: updated.status }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error) {
    return bookingErrorResponse(error, 'Failed to update booking')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    const booking = await db.booking.findFirst({ where: { id, tenantId: auth.session.tenantId } })
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    await bookingRepository.delete(auth.session.tenantId, id)
    
    broadcast('booking:deleted', { bookingNo: booking?.bookingNo }, auth.session.tenantId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return bookingErrorResponse(error, 'Failed to delete booking')
  }
}
