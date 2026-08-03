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
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    const trips = await tripService.getTrips(tenant.id)
    return NextResponse.json(trips)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'manager', 'driver'])
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateTripSchema.parse(body)
    
    const trip = await tripService.createTrip(tenant.id, validatedData)
    
    broadcast('dispatch:assigned', { tripId: trip.id, driverId: validatedData.driverId })
    return NextResponse.json(trip, { status: 201 })
  } catch (error) {
    console.error('Create trip error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateTripSchema.parse(body)
    
    const updated = await tripService.updateTrip(validatedData)
    
    broadcast('dispatch:updated', { tripId: updated.id, status: validatedData.status })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update trip error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    await tripService.deleteTrip(id)
    broadcast('dispatch:updated', { status: 'deleted' })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
