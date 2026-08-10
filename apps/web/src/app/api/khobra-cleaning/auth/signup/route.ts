import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { createSessionToken, hashPassword, SESSION_TTL_SECONDS } from '@/lib/auth'
import { verifyTurnstile } from '@/lib/turnstile'
import { checkRateLimit } from '@/lib/rate-limit'
import { getPublicTenant } from '@/lib/public-tenant'
import { SignupSchema } from '@repo/core'
import { getClientIp } from '@/lib/client-ip'
import { apiErrorResponse } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!(await checkRateLimit(`signup:${ip}`, 5, 60_000)).allowed) return NextResponse.json({ error: 'Too many signup attempts. Please wait and try again.' }, { status: 429 })
    const { name, email, phone, password, turnstileToken } = SignupSchema.parse(await req.json())
    if (!await verifyTurnstile(turnstileToken, req.headers.get('cf-connecting-ip') || undefined)) {
      return NextResponse.json({ error: 'Please complete the security check again' }, { status: 400 })
    }

    const tenant = await getPublicTenant()
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    }

    const existingUser = await db.user.findUnique({ where: { email } })
    if (existingUser && (existingUser.passwordHash || existingUser.tenantId !== tenant.id || existingUser.role !== 'customer')) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const { user, customer } = await db.$transaction(async tx => {
      const user = existingUser
        ? await tx.user.update({ where: { id: existingUser.id }, data: { passwordHash: hashPassword(password), name, phone, status: 'active', privacyPolicyVersion: 'draft-2026-08-11', privacyAcknowledgedAt: new Date(), sessionVersion: { increment: 1 } } })
        : await tx.user.create({ data: { tenantId: tenant.id, email, passwordHash: hashPassword(password), name, phone, role: 'customer', status: 'active', privacyPolicyVersion: 'draft-2026-08-11', privacyAcknowledgedAt: new Date() } })
      const customer = await tx.customer.upsert({
        where: { userId: user.id },
        update: { phone, status: 'active', deletedAt: null },
        create: { tenantId: tenant.id, userId: user.id, phone, status: 'active' },
      })
      return { user, customer }
    })

    const sessionPayload = {
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: 'customer' as const,
      name: user.name,
      sessionVersion: user.sessionVersion,
    }

    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    const token = createSessionToken(sessionPayload, expiresAt)

    const response = NextResponse.json({
      success: true,
      token,
      expiresAt: expiresAt * 1000,
      user: sessionPayload,
      customer,
    }, { status: 201 })

    response.cookies.set('khobra_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return apiErrorResponse(error, { fallback: 'Signup failed' })
  }
}
