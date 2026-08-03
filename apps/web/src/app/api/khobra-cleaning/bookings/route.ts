import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaBookingRepository } from '@repo/db'
import { BookingService } from '@repo/application'
import { CreateBookingSchema, UpdateBookingSchema, generateBookingOccurrenceDates, parseTimeToMinutes } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const bookingRepository = new PrismaBookingRepository(db)
const bookingService = new BookingService(bookingRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findUnique({ where: { id: auth.session.tenantId } })
    if (!tenant) return NextResponse.json([])
    
    let bookings = await bookingService.getBookings(tenant.id)
    if (auth.session.role === 'customer') {
      const customer = await db.customer.findFirst({ where: { tenantId: tenant.id, userId: auth.session.userId } })
      bookings = bookings.filter(booking => booking.customerId === customer?.id)
    } else if (auth.session.role === 'cleaner') {
      const cleaner = await db.employee.findFirst({ where: { tenantId: tenant.id, userId: auth.session.userId } })
      bookings = bookings.filter(booking => booking.assignments?.some(assignment => assignment.employeeId === cleaner?.id))
    }
    return NextResponse.json(bookings)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findUnique({ where: { id: auth.session.tenantId } })
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateBookingSchema.parse(body)
    if (auth.session.role === 'customer') {
      const minimumBookingAt = new Date(Date.now() + 2 * 60 * 60 * 1000)
      const startMinutes = parseTimeToMinutes(validatedData.startTime)
      const tooSoon = generateBookingOccurrenceDates(validatedData).some(date => {
        date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
        return date < minimumBookingAt
      })
      if (tooSoon) return NextResponse.json({ error: 'Customer bookings must be scheduled at least two hours in advance' }, { status: 400 })
    }
    const customer = await db.customer.findFirst({ where: { id: validatedData.customerId, tenantId: tenant.id } })
    if (!customer || (auth.session.role === 'customer' && customer.userId !== auth.session.userId)) {
      return NextResponse.json({ error: 'Customer is not allowed to create this booking' }, { status: 403 })
    }
    
    const booking = await bookingService.createBooking(tenant.id, { ...validatedData, createdBy: auth.session.role })
    
    broadcast('booking:created', { bookingNo: booking.bookingNo, status: 'pending', service: booking.service?.name })
    return NextResponse.json(booking, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request data' }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Create booking error:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    const body = await req.json()
    const validatedData = UpdateBookingSchema.parse(body)
    const booking = await db.booking.findUnique({ where: { id: validatedData.id }, include: { customer: true } })
    if (!booking || booking.tenantId !== auth.session.tenantId) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    const role = auth.session.role
    if (role === 'customer' && (booking.customer.userId !== auth.session.userId || validatedData.status !== 'cancelled'))
      return NextResponse.json({ error: 'Customers may only cancel their own bookings' }, { status: 403 })
    if (role === 'driver' && (!(booking.status === 'scheduled' || booking.status === 'confirmed') || validatedData.status !== 'on_the_way'))
      return NextResponse.json({ error: "Drivers may only change Scheduled bookings to On the Way" }, { status: 403 })
    if (role === 'cleaner') {
      const cleaner = await db.employee.findFirst({ where: { tenantId: booking.tenantId, userId: auth.session.userId } })
      const assigned = cleaner && await db.assignment.findFirst({ where: { bookingId: booking.id, employeeId: cleaner.id } })
      const allowed = (booking.status === 'on_the_way' && validatedData.status === 'in_progress') || (booking.status === 'in_progress' && validatedData.status === 'completed')
      if (!assigned || !allowed) return NextResponse.json({ error: 'Cleaners may only progress their assigned booking from On the Way to In Progress, then Completed' }, { status: 403 })
    }
    if (!['admin', 'customer', 'driver', 'cleaner'].includes(role))
      return NextResponse.json({ error: 'You are not authorized to update booking status' }, { status: 403 })
    
    const updateData = role === 'admin'
      ? validatedData
      : role === 'customer'
        ? { id: validatedData.id, status: validatedData.status, cancellationReason: validatedData.cancellationReason, cancelledBy: 'customer' as const }
        : { id: validatedData.id, status: validatedData.status }
    const updated = await bookingService.updateBooking(updateData)
    
    broadcast('booking:updated', { bookingNo: updated.bookingNo, status: updated.status })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request data' }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Update booking error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'manager'])
    if ('response' in auth) return auth.response
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    const booking = await db.booking.findFirst({ where: { id, tenantId: auth.session.tenantId } })
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    await bookingService.deleteBooking(id)
    
    broadcast('booking:deleted', { bookingNo: booking?.bookingNo })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
