import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaBranchRepository } from '@repo/db'
import { BranchService } from '@repo/application'
import { CreateBranchSchema, UpdateBranchSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

// ponytail: single service instance
const branchRepository = new PrismaBranchRepository(db)
const branchService = new BranchService(branchRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response
    
    const branches = await branchService.getBranches(auth.session.tenantId)
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
    
    const branch = await branchService.createBranch(auth.session.tenantId, validatedData)
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
    
    const updated = await branchService.updateBranch(auth.session.tenantId, validatedData)
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
    
    await branchService.deleteBranch(auth.session.tenantId, id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete branch' }, { status: 500 })
  }
}

