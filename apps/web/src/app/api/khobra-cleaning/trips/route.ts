import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaTripRepository } from '@repo/db'
import { TripService } from '@repo/application'
import { CreateTripSchema, UpdateTripSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const tripRepository = new PrismaTripRepository(db as any)
const tripService = new TripService(tripRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'driver'])
    if ('response' in auth) return auth.response

    const trips = await tripService.getTrips(auth.session.tenantId)
    if (auth.session.role === 'admin') return NextResponse.json(trips)
    const driver = await db.driver.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
    return NextResponse.json(trips.filter(trip => trip.driverId === driver?.id))
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = CreateTripSchema.parse(body)
    if (!await db.driver.findFirst({ where: { id: validatedData.driverId, tenantId: auth.session.tenantId } })) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    
    const trip = await tripService.createTrip(auth.session.tenantId, validatedData)
    
    broadcast('dispatch:assigned', { tripId: trip.id, driverId: validatedData.driverId }, auth.session.tenantId)
    return NextResponse.json(trip, { status: 201 })
  } catch (error) {
    console.error('Create trip error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
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
    
    const updated = await tripService.updateTrip(validatedData)
    
    broadcast('dispatch:updated', { tripId: updated.id, status: validatedData.status }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update trip error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
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

    await tripService.deleteTrip(id)
    broadcast('dispatch:updated', { status: 'deleted' }, auth.session.tenantId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
