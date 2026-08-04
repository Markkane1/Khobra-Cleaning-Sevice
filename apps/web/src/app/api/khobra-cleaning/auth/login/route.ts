import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { createSessionToken, SESSION_TTL_SECONDS, verifyPassword } from '@/lib/auth'
import { verifyTurnstile } from '@/lib/turnstile'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'anonymous'
    const rate = checkRateLimit(`login:${ip}`, 10, 60_000)
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Too many login attempts. Please wait a minute and try again.' }, { status: 429 })
    }

    const { email, password, turnstileToken } = await req.json()


    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    if (!await verifyTurnstile(turnstileToken, req.headers.get('cf-connecting-ip') || undefined)) {
      return NextResponse.json({ error: 'Please complete the security check again' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!user?.passwordHash || user.status !== 'active' || !user.tenantId || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const sessionPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      name: user.name,
      sessionVersion: user.sessionVersion,
    }

    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    const token = createSessionToken(sessionPayload, expiresAt)
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    const response = NextResponse.json({
      success: true,
      token,
      expiresAt: expiresAt * 1000,
      user: sessionPayload,
    })

    // Set HTTP-Only session cookie
    response.cookies.set('khobra_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 })
  }
}
