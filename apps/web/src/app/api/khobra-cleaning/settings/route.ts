import { NextRequest, NextResponse } from 'next/server'
import { db, PrismaSettingsRepository } from '@repo/db'
import { SettingsService } from '@repo/application'
import { UpdateSettingsSchema } from '@repo/core'
import { requireAuth } from '@/lib/auth'

// ponytail: single settings service instance
const settingsRepository = new PrismaSettingsRepository(db)
const settingsService = new SettingsService(settingsRepository)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const settings = await settingsService.getSettings(auth.session.tenantId)
    
    // SEC-004: Cleaners, drivers, and customers get public-safe settings only
    if (auth.session.role !== 'admin') {
      const publicKeys = ['businessName', 'currency', 'supportEmail', 'supportPhone', 'workingHours']
      const filtered = Object.fromEntries(publicKeys.filter(key => key in settings.settings).map(key => [key, settings.settings[key]]))
      const tenant = settings.tenant ? { name: settings.tenant.name, currency: settings.tenant.currency, locale: settings.tenant.locale, timezone: settings.tenant.timezone, logoUrl: settings.tenant.logoUrl, firstBookingTime: settings.tenant.firstBookingTime, lastWorkingTime: settings.tenant.lastWorkingTime } : null
      return NextResponse.json({ tenant, settings: filtered })
    }

    return NextResponse.json(settings)
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
    
    const response = await settingsService.updateSettings(auth.session.tenantId, validatedData)
    
    return NextResponse.json(response)
  } catch (error: any) {
    if (error.message === 'Tenant not found') {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 })
  }
}

