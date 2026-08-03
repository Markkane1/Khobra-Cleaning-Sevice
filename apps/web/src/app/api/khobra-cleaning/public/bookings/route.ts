import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, PrismaBookingRepository } from '@repo/db'
import { BookingService } from '@repo/application'
import { CreateBookingSchema, parseTimeToMinutes } from '@repo/core'
import { broadcast } from '@/lib/broadcast'

const bookingService = new BookingService(new PrismaBookingRepository(db))
const PublicBookingSchema = z.object({
  serviceId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(24),
  scheduledDate: z.string().date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().int().min(2).max(8),
  employeeCount: z.number().int().min(1).max(10),
  address: z.string().trim().min(5).max(250),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const input = PublicBookingSchema.parse(await req.json())
    const tenant = await db.tenant.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!tenant) return NextResponse.json({ error: 'Booking is temporarily unavailable' }, { status: 503 })

    const service = await db.service.findFirst({ where: { id: input.serviceId, tenantId: tenant.id, status: 'active' } })
    if (!service) return NextResponse.json({ error: 'This service is no longer available' }, { status: 400 })

    const startMinutes = parseTimeToMinutes(input.startTime)
    const endMinutes = startMinutes + input.duration * 60
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
    const bookingAt = new Date(`${input.scheduledDate}T${input.startTime}:00`)
    if (endMinutes >= 24 * 60) return NextResponse.json({ error: 'Choose an earlier start time' }, { status: 400 })
    if (startMinutes < parseTimeToMinutes(tenant.firstBookingTime || '08:00') || endMinutes > parseTimeToMinutes(tenant.lastWorkingTime || '20:00')) {
      return NextResponse.json({ error: `Bookings are available from ${tenant.firstBookingTime || '08:00'} to ${tenant.lastWorkingTime || '20:00'}` }, { status: 400 })
    }
    if (bookingAt.getTime() < Date.now() + 2 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Bookings require at least two hours notice' }, { status: 400 })
    }

    const existingUser = await db.user.findUnique({ where: { email: input.email }, include: { customer: true } })
    if (existingUser && (existingUser.role !== 'customer' || existingUser.tenantId !== tenant.id)) {
      return NextResponse.json({ error: 'Please sign in to use this email address' }, { status: 409 })
    }

    const customer = existingUser?.customer || await db.$transaction(async tx => {
      const user = existingUser || await tx.user.create({
        data: { tenantId: tenant.id, email: input.email, name: input.name, role: 'customer', status: 'active' },
      })
      return tx.customer.create({
        data: { tenantId: tenant.id, userId: user.id, phone: input.phone, address: input.address, city: input.city, area: input.area, status: 'active' },
      })
    })

    const bookingData = CreateBookingSchema.parse({
      customerId: customer.id,
      serviceId: service.id,
      serviceIds: [service.id],
      scheduledDate: input.scheduledDate,
      startDate: input.scheduledDate,
      endDate: input.scheduledDate,
      startTime: input.startTime,
      endTime,
      employeeCount: input.employeeCount,
      bookingType: 'one_time',
      address: input.address,
      city: input.city,
      area: input.area,
      notes: input.notes,
      createdBy: 'public',
    })
    const booking = await bookingService.createBooking(tenant.id, bookingData)
    broadcast('booking:created', { bookingNo: booking.bookingNo, status: booking.status, service: service.name })
    return NextResponse.json({ bookingNo: booking.bookingNo, total: booking.netAmount, service: service.name }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Check your booking details' }, { status: 400 })
    console.error('Public booking error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Booking failed' }, { status: 400 })
  }
}
