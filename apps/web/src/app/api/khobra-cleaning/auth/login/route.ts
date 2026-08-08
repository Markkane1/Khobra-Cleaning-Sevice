import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { createSessionToken, isRoleId, SESSION_TTL_SECONDS, verifyPassword } from '@/lib/auth'
import { verifyTurnstile } from '@/lib/turnstile'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/client-ip'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rate = await checkRateLimit(`login:${ip}`, 10, 60_000)
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Too many login attempts. Please wait a minute and try again.' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }
    const { email, password, turnstileToken } = body

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    const normalizedEmail = email.trim().toLowerCase()
    if (!(await checkRateLimit(`login-account:${normalizedEmail.slice(0, 254)}`, 20, 5 * 60_000)).allowed) {
      return NextResponse.json({ error: 'Too many login attempts. Please wait five minutes and try again.' }, { status: 429 })
    }
    if (!await verifyTurnstile(turnstileToken, req.headers.get('cf-connecting-ip') || undefined)) {
      return NextResponse.json({ error: 'Please complete the security check again' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (!user?.passwordHash || user.status !== 'active' || !user.tenantId || !isRoleId(user.role) || !verifyPassword(password, user.passwordHash)) {
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
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
