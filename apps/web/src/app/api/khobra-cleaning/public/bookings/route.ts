import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaBookingRepository } from '@repo/db'
import { CreateBookingSchema, parseTimeToMinutes, PublicBookingSchema, zonedDateTimeToUtc } from '@repo/core'
import { broadcast } from '@/lib/broadcast'
import { getAuthSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'
import { apiErrorResponse } from '@/lib/api-error'
import { getPublicTenant } from '@/lib/public-tenant'


const bookingRepository = new PrismaBookingRepository(db)
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!(await checkRateLimit(`public-booking:${ip}`, 10, 60_000)).allowed) return NextResponse.json({ error: 'Too many booking attempts. Please wait and try again.' }, { status: 429 })
    const input = PublicBookingSchema.parse(await req.json())
    const authSession = await getAuthSession(req).catch(() => null)
    const tenant = authSession?.role === 'customer'
      ? await db.tenant.findUnique({ where: { id: authSession.tenantId } })
      : await getPublicTenant()
    if (!tenant || tenant.status !== 'active') return NextResponse.json({ error: 'Booking is temporarily unavailable' }, { status: 503 })

    const service = await db.service.findFirst({ where: { id: input.serviceId, tenantId: tenant.id, status: 'active' } })
    if (!service) return NextResponse.json({ error: 'This service is no longer available' }, { status: 400 })

    const startMinutes = parseTimeToMinutes(input.startTime)
    const endMinutes = startMinutes + input.duration * 60
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
    const bookingAt = zonedDateTimeToUtc(input.scheduledDate, input.startTime, tenant.timezone || 'UTC')
    if (endMinutes >= 24 * 60) return NextResponse.json({ error: 'Choose an earlier start time' }, { status: 400 })
    if (startMinutes < parseTimeToMinutes(tenant.firstBookingTime || '08:00') || endMinutes > parseTimeToMinutes(tenant.lastWorkingTime || '20:00')) {
      return NextResponse.json({ error: `Bookings are available from ${tenant.firstBookingTime || '08:00'} to ${tenant.lastWorkingTime || '20:00'}` }, { status: 400 })
    }
    if (bookingAt.getTime() < Date.now() + 2 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Bookings require at least two hours notice' }, { status: 400 })
    }

    let actor = authSession?.role === 'customer'
      ? { userId: authSession.userId, name: authSession.name }
      : null
    let customer = actor
      ? await db.customer.findFirst({ where: { tenantId: tenant.id, userId: actor.userId, deletedAt: null } })
      : null

    if (actor && !customer) return NextResponse.json({ error: 'Customer profile not found.' }, { status: 403 })

    if (!actor) {
      const guest = await db.$transaction(async tx => {
        const existing = await tx.user.findUnique({ where: { email: input.email } })
        if (existing?.passwordHash || (existing && (existing.tenantId !== tenant.id || existing.role !== 'customer'))) return null

        const user = existing
          ? await tx.user.update({ where: { id: existing.id }, data: { name: input.name, phone: input.phone, status: 'active' } })
          : await tx.user.create({ data: { tenantId: tenant.id, email: input.email, name: input.name, phone: input.phone, role: 'customer', status: 'active' } })
        const savedAddress = { label: 'Primary', address: input.address || 'Pinned GPS location', city: input.city, area: input.area || '', latitude: input.latitude, longitude: input.longitude }
        const customer = await tx.customer.upsert({
          where: { userId: user.id },
          update: { phone: input.phone, address: savedAddress.address, addresses: [savedAddress], city: input.city, area: input.area, status: 'active', deletedAt: null },
          create: { tenantId: tenant.id, userId: user.id, phone: input.phone, address: savedAddress.address, addresses: [savedAddress], city: input.city, area: input.area, status: 'active' },
        })
        return { user, customer }
      })
      if (!guest) return NextResponse.json({ error: 'An account already uses this email. Sign in to continue with it.' }, { status: 409 })
      actor = { userId: guest.user.id, name: guest.user.name }
      customer = guest.customer
    }


    const bookingData = CreateBookingSchema.parse({
      customerId: customer!.id,
      serviceId: service.id,
      serviceIds: [service.id],
      serviceOptions: [{ serviceId: service.id, withMaterials: input.withMaterials }],
      scheduledDate: input.scheduledDate,
      startDate: input.scheduledDate,
      endDate: input.scheduledDate,
      startTime: input.startTime,
      endTime,
      employeeCount: input.employeeCount,
      bookingType: 'one_time',
      address: input.address || 'Pinned GPS location',
      city: input.city,
      area: input.area,
      latitude: input.latitude,
      longitude: input.longitude,
      notes: input.notes,
      preferredPaymentMethod: input.preferredPaymentMethod,
    })
    const booking = await bookingRepository.create(tenant.id, bookingData, {
      userId: actor!.userId,
      role: 'customer',
      name: actor!.name,
    })
    broadcast('booking:created', { bookingNo: booking.bookingNo, status: booking.status, service: service.name }, tenant.id)
    return NextResponse.json({ bookingNo: booking.bookingNo, total: booking.netAmount, service: service.name, guest: !authSession }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Booking failed', domainErrorStatus: 400 })
  }
}
