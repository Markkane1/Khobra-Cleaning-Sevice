import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaComplaintRepository } from '@repo/db'
import { ComplaintService } from '@repo/application'
import { CreateComplaintSchema, UpdateComplaintSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

const complaintService = new ComplaintService(new PrismaComplaintRepository(db))

function errorResponse(error: unknown, fallback: string) {
  return apiErrorResponse(error, { fallback, missing: 'Complaint or related record not found', conflict: 'This complaint conflicts with an existing record', domainErrorStatus: 400 })
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer', 'cleaner'])
    if ('response' in auth) return auth.response

    const items = await complaintService.getComplaints(auth.session.tenantId)
    if (auth.session.role === 'admin') return NextResponse.json(items)

    if (auth.session.role === 'customer') {
      const customer = await db.customer.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
      return NextResponse.json(items.filter(item => item.customerId === customer?.id))
    }

    const cleaner = await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
    if (!cleaner) return NextResponse.json([])
    const assignments = await db.assignment.findMany({ where: { employeeId: cleaner.id }, select: { bookingId: true } })
    const assignedBookingIds = new Set(assignments.map(item => item.bookingId))
    return NextResponse.json(items.filter(item => item.bookingId && assignedBookingIds.has(item.bookingId)))
  } catch (error) {
    return errorResponse(error, 'Failed to load complaints')
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer', 'cleaner'])
    if ('response' in auth) return auth.response

    const validated = CreateComplaintSchema.parse(await req.json())
    let customerId = validated.customerId

    if (auth.session.role === 'cleaner') {
      if (!validated.bookingId) return NextResponse.json({ error: 'Select an assigned booking before reporting a customer issue' }, { status: 400 })
      const cleaner = await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
      const booking = cleaner ? await db.booking.findFirst({
        where: { id: validated.bookingId, tenantId: auth.session.tenantId, assignments: { some: { employeeId: cleaner.id } } },
        select: { customerId: true },
      }) : null
      if (!booking) return NextResponse.json({ error: 'Only an assigned cleaner may report an issue for this booking' }, { status: 403 })
      customerId = booking.customerId
    } else if (auth.session.role === 'customer') {
      const customer = await db.customer.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
      if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 403 })
      if (validated.bookingId) {
        const booking = await db.booking.findFirst({ where: { id: validated.bookingId, tenantId: auth.session.tenantId, customerId: customer.id } })
        if (!booking) return NextResponse.json({ error: 'You may only report issues for your own bookings' }, { status: 403 })
      }
      customerId = customer.id
    } else {
      const booking = validated.bookingId ? await db.booking.findFirst({ where: { id: validated.bookingId, tenantId: auth.session.tenantId } }) : null
      if (validated.bookingId && !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      if (booking && customerId && booking.customerId !== customerId) return NextResponse.json({ error: 'Selected customer does not match the booking' }, { status: 400 })
      customerId = booking?.customerId || customerId
      if (customerId && !await db.customer.findFirst({ where: { id: customerId, tenantId: auth.session.tenantId } })) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
    }

    const complaint = await complaintService.createComplaint(auth.session.tenantId, {
      ...validated,
      customerId,
      category: validated.category || (auth.session.role === 'cleaner' ? 'Customer Issue' : undefined),
      status: 'open',
      resolution: undefined,
      assignedTo: undefined,
      resolvedAt: undefined,
    })
    broadcast('complaint:created', { complaintNo: complaint.complaintNo, priority: complaint.priority, category: complaint.category }, auth.session.tenantId)
    return NextResponse.json(complaint, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'Failed to create complaint')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const validated = UpdateComplaintSchema.parse(await req.json())
    const existing = await db.complaint.findFirst({ where: { id: validated.id, tenantId: auth.session.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    const updated = await complaintService.updateComplaint(auth.session.tenantId, validated)
    broadcast('complaint:updated', { complaintNo: updated.complaintNo, status: updated.status }, auth.session.tenantId)
    return NextResponse.json(updated)
  } catch (error) {
    return errorResponse(error, 'Failed to update complaint')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const existing = await db.complaint.findFirst({ where: { id, tenantId: auth.session.tenantId } })
    if (!existing) return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    await complaintService.deleteComplaint(auth.session.tenantId, id)
    broadcast('complaint:updated', { complaintNo: existing.complaintNo, status: 'deleted' }, auth.session.tenantId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'Failed to delete complaint')
  }
}
