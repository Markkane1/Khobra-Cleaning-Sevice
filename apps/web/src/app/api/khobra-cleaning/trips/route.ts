import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaTripRepository } from '@repo/db'
import { CreateTripSchema, UpdateTripSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const tripRepository = new PrismaTripRepository(db as any)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'driver'])
    if ('response' in auth) return auth.response

    const trips = await tripRepository.findManyByTenant(auth.session.tenantId)
    if (auth.session.role === 'admin') return NextResponse.json(trips)
    const driver = await db.driver.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
    return NextResponse.json(trips.filter(trip => trip.driverId === driver?.id))
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to fetch trips' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = CreateTripSchema.parse(body)
    if (!await db.driver.findFirst({ where: { id: validatedData.driverId, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    
    const trip = await tripRepository.create(auth.session.tenantId, validatedData)
    
    broadcast('dispatch:assigned', { tripId: trip.id, driverId: validatedData.driverId }, auth.session.tenantId)
    return NextResponse.json(trip, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to create trip', relatedRecord: 'The selected driver or booking no longer exists' })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'driver'])
    if ('response' in auth) return auth.response
    const body = await req.json()
    const validatedData = UpdateTripSchema.parse(body)
    const existing = await db.trip.findFirst({ where: { id: validatedData.id, tenantId: auth.session.tenantId }, include: { driver: true } })
    if (!existing) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (validatedData.driverId && validatedData.driverId !== existing.driverId && await db.tripStop.count({ where: { tripId: existing.id, bookingId: { not: null } } })) {
      return NextResponse.json({ error: 'Reassign linked bookings from the Dispatch board instead of changing this trip driver' }, { status: 409 })
    }
    if (validatedData.status === 'completed' && await db.tripStop.count({ where: { tripId: existing.id, booking: { status: { notIn: ['completed', 'cancelled', 'no_show'] } } } })) {
      return NextResponse.json({ error: 'Complete or cancel every linked booking before completing this trip' }, { status: 409 })
    }
    if (auth.session.role === 'driver') {
      if (existing.driver.userId !== auth.session.userId) return NextResponse.json({ error: 'This trip is assigned to another driver' }, { status: 403 })
      const allowedKeys = Object.keys(validatedData).every(key => ['id', 'status', 'startMileage', 'endMileage', 'stops'].includes(key))
      const validTransition = !validatedData.status || (existing.status === 'planned' && validatedData.status === 'in_progress') || (existing.status === 'in_progress' && validatedData.status === 'completed')
      if (!allowedKeys || !validTransition) return NextResponse.json({ error: 'Drivers may only advance their own trip from Planned to In Progress to Completed' }, { status: 403 })
      if (validatedData.stops?.length) {
        const stopIds = validatedData.stops.map(stop => stop.id)
        if (await db.tripStop.count({ where: { id: { in: stopIds }, tripId: existing.id } }) !== stopIds.length) return NextResponse.json({ error: 'One or more stops do not belong to this trip' }, { status: 403 })
      }
    }
    
    const updated = await tripRepository.update(auth.session.tenantId, validatedData.id, validatedData)
    
    broadcast('dispatch:updated', { tripId: updated.id, status: validatedData.status }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to update trip', missing: 'Trip not found', relatedRecord: 'A selected trip stop or driver no longer exists' })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    if (!await db.trip.findFirst({ where: { id, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (await db.tripStop.count({ where: { tripId: id, booking: { status: { notIn: ['completed', 'cancelled', 'no_show'] } } } })) return NextResponse.json({ error: 'This trip contains active bookings. Reassign those bookings before deleting it.' }, { status: 409 })

    await tripRepository.delete(auth.session.tenantId, id)
    broadcast('dispatch:updated', { status: 'deleted' }, auth.session.tenantId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to delete trip', missing: 'Trip not found', relatedRecord: 'This trip is still in use and cannot be deleted' })
  }
}
