import { NextRequest, NextResponse } from 'next/server'
import { broadcast } from '@/lib/broadcast'
import { db, PrismaComplaintRepository } from '@repo/db'
import { ComplaintService } from '@repo/application'
import { CreateComplaintSchema, UpdateComplaintSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const complaintRepository = new PrismaComplaintRepository(db)
const complaintService = new ComplaintService(complaintRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json([])
    
    const items = await complaintService.getComplaints(tenant.id)
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const tenant = await db.tenant.findFirst()
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
    
    const body = await req.json()
    const validatedData = CreateComplaintSchema.parse(body)
    
    const complaint = await complaintService.createComplaint(tenant.id, validatedData)
    
    broadcast('complaint:created', { complaintNo: complaint.complaintNo, priority: complaint.priority, category: complaint.category })
    return NextResponse.json(complaint, { status: 201 })
  } catch (error) {
    console.error('Create complaint error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const validatedData = UpdateComplaintSchema.parse(body)
    
    const updated = await complaintService.updateComplaint(validatedData)
    
    broadcast('complaint:updated', { complaintNo: updated.complaintNo, status: updated.status })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update complaint error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    await complaintService.deleteComplaint(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
