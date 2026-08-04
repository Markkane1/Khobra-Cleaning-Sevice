import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { createSessionToken, hashPassword, SESSION_TTL_SECONDS } from '@/lib/auth'
import { verifyTurnstile } from '@/lib/turnstile'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'anonymous'
    if (!checkRateLimit(`signup:${ip}`, 5, 60_000).allowed) return NextResponse.json({ error: 'Too many signup attempts. Please wait and try again.' }, { status: 429 })
    const { name, email, phone, city, area, address, password, turnstileToken } = await req.json()

    if (!name || !email || !phone || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Name, email, phone, and a password of at least 8 characters are required' }, { status: 400 })
    }
    if (!await verifyTurnstile(turnstileToken, req.headers.get('cf-connecting-ip') || undefined)) {
      return NextResponse.json({ error: 'Please complete the security check again' }, { status: 400 })
    }

    const tenant = await db.tenant.findFirst()
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 })
    }

    const { user, customer } = await db.$transaction(async tx => {
      const user = await tx.user.create({ data: { tenantId: tenant.id, email: normalizedEmail, passwordHash: hashPassword(password), name, phone, role: 'customer', status: 'active' } })
      const customer = await tx.customer.create({ data: { tenantId: tenant.id, userId: user.id, phone, city, area, address, status: 'active' } })
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
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: error.message || 'Signup failed' }, { status: 500 })
  }
}
