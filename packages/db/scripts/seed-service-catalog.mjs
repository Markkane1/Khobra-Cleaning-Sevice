import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const services = [
  ['Bathroom Sanitization', 'Deep sanitization of bathrooms', 700, 'Specialized', 'bathroom,sanitization', 'deep-cleaning'],
  ['Deep House Cleaning', 'Complete deep cleaning of all rooms, kitchen, and bathrooms', 800, 'Cleaning', 'deep_cleaning,bathroom,kitchen', 'deep-cleaning'],
  ['Kitchen Deep Clean', 'Thorough kitchen cleaning including appliances', 900, 'Specialized', 'kitchen,deep_cleaning', 'deep-cleaning'],
  ['Move-in/Move-out Clean', 'Comprehensive cleaning for moving', 1200, 'Specialized', 'deep_cleaning,moving', 'standard-home-cleaning'],
  ['Office Cleaning', 'Professional office space cleaning', 600, 'Commercial', 'office,commercial', 'office-cleaning'],
  ['Standard Cleaning', 'Regular surface cleaning and tidying', 500, 'Cleaning', 'surface_cleaning', 'standard-home-cleaning'],
]

const tenant = await db.tenant.findFirstOrThrow({ where: { slug: process.env.PUBLIC_TENANT_SLUG || 'khobra-cleaning' } })
for (const [name, description, rate, category, skills, image] of services) {
  const existing = await db.service.findFirst({ where: { tenantId: tenant.id, name } })
  const data = { description, baseRate: rate, withMaterialsRate: rate, minDuration: 2, category, skills, status: 'active', heroImages: [`/service-images/${image}-hero.webp`], galleryImages: [`/service-images/${image}.webp`] }
  if (existing) await db.service.update({ where: { id: existing.id }, data })
  else await db.service.create({ data: { tenantId: tenant.id, name, ...data } })
}
console.log(`Seeded ${services.length} service catalog records for ${tenant.slug}.`)
await db.$disconnect()
