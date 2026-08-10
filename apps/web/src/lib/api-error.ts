import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'

type ApiErrorOptions = {
  fallback: string
  conflict?: string
  missing?: string
  relatedRecord?: string
  domainErrorStatus?: number
}

export function apiErrorResponse(error: unknown, options: ApiErrorOptions) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))
    return NextResponse.json({ error: issues[0]?.message || 'Check the submitted details', issues }, { status: 400 })
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'The request body is not valid JSON' }, { status: 400 })
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`${options.fallback}:`, error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: options.conflict || 'A record with these details already exists' }, { status: 409 })
    }
    if (error.code === 'P2003') {
      return NextResponse.json({ error: options.relatedRecord || 'A selected related record no longer exists. Refresh and try again.' }, { status: 409 })
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: options.missing || 'The requested record was not found' }, { status: 404 })
    }
    return NextResponse.json({ error: options.fallback }, { status: 500 })
  }

  if (
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    console.error(`${options.fallback}:`, error)
    return NextResponse.json({ error: options.fallback }, { status: 500 })
  }

  if (error instanceof Error && /not found/i.test(error.message)) {
    console.error(`${options.fallback}:`, error)
    return NextResponse.json({ error: options.missing || 'The requested record was not found' }, { status: 404 })
  }

  const explicitStatus = (error as { status?: unknown } | null)?.status
  const status = typeof explicitStatus === 'number' ? explicitStatus : options.domainErrorStatus
  if (error instanceof Error && typeof status === 'number' && status >= 400 && status < 500) {
    return NextResponse.json({ error: error.message }, { status })
  }

  console.error(`${options.fallback}:`, error)

  return NextResponse.json({ error: options.fallback }, { status: 500 })
}
