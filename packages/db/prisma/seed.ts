import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`
}

async function main() {
  console.log('Seeding Khobra Cleaning Service database...')

  // 1. Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'khobra-cleaners' },
    update: {},
    create: {
      name: 'Khobra Cleaning Services',
      slug: 'khobra-cleaners',
      currency: 'AED',
      locale: 'en-AE',
      timezone: 'Asia/Dubai',
      taxRate: 5.0,
      firstBookingTime: '08:00',
      lastWorkingTime: '20:00',
      status: 'active',
    },
  })

  // 2. Admin User
  const adminPassword = hashPassword('Admin123!')
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@khobra.com' },
    update: { passwordHash: adminPassword, role: 'admin', status: 'active' },
    create: {
      tenantId: tenant.id,
      email: 'admin@khobra.com',
      passwordHash: adminPassword,
      name: 'System Admin',
      role: 'admin',
      status: 'active',
    },
  })

  // 3. Cleaner User & Employee
  const cleanerPassword = hashPassword('Cleaner123!')
  const cleanerUser = await prisma.user.upsert({
    where: { email: 'cleaner@khobra.com' },
    update: { passwordHash: cleanerPassword, role: 'cleaner', status: 'active' },
    create: {
      tenantId: tenant.id,
      email: 'cleaner@khobra.com',
      passwordHash: cleanerPassword,
      name: 'Fatima Al-Cleaner',
      role: 'cleaner',
      status: 'active',
    },
  })

  await prisma.employee.upsert({
    where: { userId: cleanerUser.id },
    update: { status: 'active' },
    create: {
      tenantId: tenant.id,
      userId: cleanerUser.id,
      employeeCode: 'EMP-1001',
      phone: '+971500000001',
      baseSalary: 3500,
      status: 'active',
    },
  })

  // 4. Driver User & Record
  const driverPassword = hashPassword('Driver123!')
  const driverUser = await prisma.user.upsert({
    where: { email: 'driver@khobra.com' },
    update: { passwordHash: driverPassword, role: 'driver', status: 'active' },
    create: {
      tenantId: tenant.id,
      email: 'driver@khobra.com',
      passwordHash: driverPassword,
      name: 'Tariq Al-Driver',
      role: 'driver',
      status: 'active',
    },
  })

  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: { status: 'active' },
    create: {
      tenantId: tenant.id,
      userId: driverUser.id,
      driverCode: 'DRV-1001',
      phone: '+971500000002',
      vehicleInfo: 'Toyota HiAce Van (DX-4921)',
      licenseNo: 'UAE-992014',
      status: 'active',
    },
  })

  // 5. Customer User & Profile
  const customerPassword = hashPassword('Customer123!')
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@khobra.com' },
    update: { passwordHash: customerPassword, role: 'customer', status: 'active' },
    create: {
      tenantId: tenant.id,
      email: 'customer@khobra.com',
      passwordHash: customerPassword,
      name: 'Ahmed Customer',
      role: 'customer',
      status: 'active',
    },
  })

  await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: { status: 'active' },
    create: {
      tenantId: tenant.id,
      userId: customerUser.id,
      phone: '+971500000003',
      address: 'Villa 14, Street 8, Downtown Dubai',
      city: 'Dubai',
      area: 'Downtown',
      status: 'active',
    },
  })

  // 6. Company Bank Account
  const bankAccount = await prisma.companyBankAccount.findFirst({
    where: { tenantId: tenant.id, accountNumber: '1234567890' },
  })

  if (!bankAccount) {
    await prisma.companyBankAccount.create({
      data: {
        tenantId: tenant.id,
        bankName: 'Emirates NBD',
        accountTitle: 'Khobra Cleaning Services LLC',
        accountNumber: '1234567890',
        iban: 'AE290260000001234567890',
        branchName: 'Downtown Dubai',
        branchCode: '026',
        currency: 'AED',
        isDefault: true,
        isActive: true,
      },
    })
  }

  // 7. Standard Services
  const services = [
    { name: 'Standard Home Cleaning', baseRate: 35.0, category: 'Residential', description: 'Comprehensive general home dusting, vacuuming, and surface sanitization.' },
    { name: 'Deep Cleaning', baseRate: 60.0, category: 'Residential', description: 'Intensive deep sanitation of kitchen, bathrooms, fixtures, and hidden grime.' },
    { name: 'Office Cleaning', baseRate: 45.0, category: 'Commercial', description: 'Professional corporate workstation, pantry, and meeting area cleaning.' },
    { name: 'Carpet & Upholstery', baseRate: 50.0, category: 'Specialized', description: 'Steam and hot-water extraction for carpets, rugs, and fabric furniture.' },
    { name: 'Window Cleaning', baseRate: 40.0, category: 'Specialized', description: 'Interior and exterior glass pane crystal clear cleaning.' },
  ]

  for (const s of services) {
    const existing = await prisma.service.findFirst({ where: { tenantId: tenant.id, name: s.name } })
    if (!existing) {
      await prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: s.name,
          baseRate: s.baseRate,
          category: s.category,
          description: s.description,
          status: 'active',
        },
      })
    }
  }

  // 8. Fix existing passwordless users by giving them default password
  const passwordlessUsers = await prisma.user.findMany({ where: { passwordHash: null } })
  for (const user of passwordlessUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword('Khobra2026!') },
    })
  }

  // 9. Fix completed bookings without invoices (FIN-013)
  const completedWithoutInvoice = await prisma.booking.findMany({
    where: { status: 'completed', invoices: { none: {} } },
  })
  for (const b of completedWithoutInvoice) {
    await prisma.invoice.create({
      data: {
        tenantId: b.tenantId,
        bookingId: b.id,
        customerId: b.customerId,
        invoiceNo: `INV-${b.bookingNo}`,
        status: 'issued',
        issuedAt: b.completedAt || b.createdAt,
        subtotal: b.netAmount,
        totalAmount: b.netAmount,
        paidAmount: 0,
      },
    })
  }

  console.log(`Seeding complete. Updated ${passwordlessUsers.length} passwordless users, fixed ${completedWithoutInvoice.length} orphan completed bookings.`)
}


main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
