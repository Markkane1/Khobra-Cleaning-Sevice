import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaSettingsRepository } from '@repo/db'
import { SettingsService } from '@repo/application'
import { UpdateSettingsSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

// Dependency Injection
const settingsRepository = new PrismaSettingsRepository(db)
const settingsService = new SettingsService(settingsRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const response = await settingsService.getSettings()
    return NextResponse.json(response)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const body = await req.json()
    const validatedData = UpdateSettingsSchema.parse(body)
    
    const response = await settingsService.updateSettings(validatedData)
    
    return NextResponse.json(response)
  } catch (error: any) {
    if (error.message === 'Tenant not found') {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 })
  }
}
