import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaBranchRepository } from '@repo/db'
import { CreateBranchSchema, UpdateBranchSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

const branchRepository = new PrismaBranchRepository(db)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    
    const branches = await branchRepository.findManyByTenant(auth.session.tenantId)
    return NextResponse.json(branches)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch branches' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    
    const body = await req.json()
    const validatedData = CreateBranchSchema.parse(body)
    
    const branch = await branchRepository.create(auth.session.tenantId, validatedData)
    return NextResponse.json(branch, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create branch' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = UpdateBranchSchema.parse(body)
    
    const updated = await branchRepository.update(auth.session.tenantId, validatedData.id, validatedData)
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update branch' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Branch ID required' }, { status: 400 })
    
    await branchRepository.delete(auth.session.tenantId, id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete branch' }, { status: 500 })
  }
}

