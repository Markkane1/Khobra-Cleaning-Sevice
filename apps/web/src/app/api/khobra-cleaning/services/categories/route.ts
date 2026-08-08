import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Cleaning', description: 'Residential and standard home cleaning services', color: 'emerald' },
  { id: 'cat-2', name: 'Specialized', description: 'Deep sanitization, carpet, sofa, and curtain care', color: 'teal' },
  { id: 'cat-3', name: 'Commercial', description: 'Office, retail, building, and commercial space cleaning', color: 'amber' },
]

const CategorySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(250).default(''),
  color: z.string().trim().regex(/^[a-z0-9_-]+$/i).max(30).default('emerald'),
})
const CategoryInputSchema = CategorySchema.omit({ id: true })
type Category = z.infer<typeof CategorySchema>
const categoryKey = (tenantId: string) => `${tenantId}:service_categories`

async function loadCategories(tenantId: string, client: Prisma.TransactionClient | typeof db = db): Promise<Category[]> {
  const setting = await client.appSettings.findUnique({ where: { key: categoryKey(tenantId) } })
  if (setting) {
    try {
      const categories = z.array(CategorySchema).safeParse(JSON.parse(setting.value))
      if (categories.success) return categories.data
    } catch {}
  }
  return DEFAULT_CATEGORIES.map(category => ({ ...category }))
}

function saveCategories(tenantId: string, categories: Category[], client: Prisma.TransactionClient | typeof db = db) {
  const key = categoryKey(tenantId)
  return client.appSettings.upsert({
    where: { key },
    update: { value: JSON.stringify(categories) },
    create: { key, value: JSON.stringify(categories), description: 'Dynamic Service Categories List' },
  })
}

function mutateCategories<T>(tenantId: string, mutate: (categories: Category[]) => T | Promise<T>) {
  return db.$transaction(async tx => {
    const key = categoryKey(tenantId)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const categories = await loadCategories(tenantId, tx)
    const result = await mutate(categories)
    await saveCategories(tenantId, categories, tx)
    return result
  })
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if ('response' in auth) return auth.response

    return NextResponse.json(await loadCategories(auth.session.tenantId))
  } catch (error: any) {
    console.error('Fetch categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const input = CategoryInputSchema.parse(await req.json())
    const newCat = await mutateCategories(auth.session.tenantId, categories => {
      const category = { id: `cat-${crypto.randomUUID()}`, ...input }
      categories.push(category)
      return category
    })

    return NextResponse.json(newCat, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid category' }, { status: 400 })
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const input = CategorySchema.parse(await req.json())
    const updated = await mutateCategories(auth.session.tenantId, categories => {
      const index = categories.findIndex(category => category.id === input.id)
      if (index < 0) return null
      categories[index] = input
      return input
    })
    return updated ? NextResponse.json(updated) : NextResponse.json({ error: 'Category not found' }, { status: 404 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid category' }, { status: 400 })
    console.error('Update category error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const deleted = await mutateCategories(auth.session.tenantId, categories => {
      const index = categories.findIndex(category => category.id === id)
      if (index < 0) return false
      categories.splice(index, 1)
      return true
    })
    return deleted ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Category not found' }, { status: 404 })
  } catch (error: any) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
