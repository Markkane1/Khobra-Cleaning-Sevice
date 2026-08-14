import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { getPublicTenant } from '@/lib/public-tenant'
import { apiErrorResponse } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

export async function POST(req: NextRequest) {
  try {
    if (!(await checkRateLimit(`deletion-request:${getClientIp(req)}`, 5, 60_000)).allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait and try again.' }, { status: 429 })
    }
    const body = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : undefined
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    const tenant = await getPublicTenant()
    await db.accountDeletionRequest.create({ data: { tenantId: tenant?.id, email, reason } })
    return NextResponse.json({ success: true, message: 'Your deletion request has been recorded.' }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Could not submit deletion request' })
  }
}
