import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Cleaning', description: 'Residential and standard home cleaning services', color: 'emerald' },
  { id: 'cat-2', name: 'Specialized', description: 'Deep sanitization, carpet, sofa, and curtain care', color: 'teal' },
  { id: 'cat-3', name: 'Commercial', description: 'Office, retail, building, and commercial space cleaning', color: 'amber' },
]

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    const setting = await db.appSettings.findUnique({ where: { key: 'service_categories' } })
    let categories = DEFAULT_CATEGORIES
    if (setting) {
      try { categories = JSON.parse(setting.value) } catch {}
    }

    return NextResponse.json(categories)
  } catch (error: any) {
    console.error('Fetch categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'manager'])
    if ('response' in auth) return auth.response

    const { name, description, color } = await req.json()
    if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 })

    const setting = await db.appSettings.findUnique({ where: { key: 'service_categories' } })
    let categories = DEFAULT_CATEGORIES
    if (setting) {
      try { categories = JSON.parse(setting.value) } catch {}
    }

    const newCat = {
      id: 'cat-' + Date.now(),
      name: name.trim(),
      description: description || '',
      color: color || 'emerald',
    }

    categories.push(newCat)

    await db.appSettings.upsert({
      where: { key: 'service_categories' },
      update: { value: JSON.stringify(categories) },
      create: { key: 'service_categories', value: JSON.stringify(categories), description: 'Dynamic Service Categories List' },
    })

    return NextResponse.json(newCat, { status: 201 })
  } catch (error: any) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'manager'])
    if ('response' in auth) return auth.response

    const { id, name, description, color } = await req.json()
    if (!id || !name) return NextResponse.json({ error: 'ID and name required' }, { status: 400 })

    const setting = await db.appSettings.findUnique({ where: { key: 'service_categories' } })
    let categories = DEFAULT_CATEGORIES
    if (setting) {
      try { categories = JSON.parse(setting.value) } catch {}
    }

    const idx = categories.findIndex(c => c.id === id)
    if (idx >= 0) {
      categories[idx] = { ...categories[idx], name, description, color }
      await db.appSettings.upsert({
        where: { key: 'service_categories' },
        update: { value: JSON.stringify(categories) },
        create: { key: 'service_categories', value: JSON.stringify(categories), description: 'Dynamic Service Categories List' },
      })
      return NextResponse.json(categories[idx])
    }

    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  } catch (error: any) {
    console.error('Update category error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'manager'])
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const setting = await db.appSettings.findUnique({ where: { key: 'service_categories' } })
    let categories = DEFAULT_CATEGORIES
    if (setting) {
      try { categories = JSON.parse(setting.value) } catch {}
    }

    categories = categories.filter(c => c.id !== id)

    await db.appSettings.upsert({
      where: { key: 'service_categories' },
      update: { value: JSON.stringify(categories) },
      create: { key: 'service_categories', value: JSON.stringify(categories), description: 'Dynamic Service Categories List' },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
