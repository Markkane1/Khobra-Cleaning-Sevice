import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

const submissionSchema = z.object({
  invoiceId: z.string().min(1),
  referenceNo: z.string().trim().min(1, 'Transaction/reference number is required').max(100),
  customerBankName: z.string().trim().min(1, 'Customer bank name is required').max(120),
  accountHolderName: z.string().trim().min(1, 'Account-holder name is required').max(120),
  transferDate: z.coerce.date(),
  amount: z.coerce.number().positive('Transfer amount must be greater than zero'),
  notes: z.string().trim().max(500).optional(),
  proofUrl: z.string().url('Payment proof is required'),
})

const decisionSchema = z.object({
  paymentId: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
  remarks: z.string().trim().min(1, 'Decision remarks are required').max(500),
})

const proofBelongsToTenant = (proofUrl: string, tenantId: string) => {
  try {
    const url = new URL(proofUrl)
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && Boolean(cloudName) && url.pathname.includes(`/${cloudName}/`) && url.pathname.includes(`/${tenantId}/payment-proofs/`) && /\.(jpe?g|png|webp|pdf)$/i.test(url.pathname)
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['customer', 'admin'])
  if ('response' in auth) return auth.response
  const settings = Object.fromEntries((await db.appSettings.findMany({ where: { key: { startsWith: 'bank' } } })).map(item => [item.key, item.value]))
  const bankAccount = {
    active: settings.bankAccountActive === 'true',
    accountTitle: settings.bankAccountTitle || '',
    bankName: settings.bankName || '',
    accountNumber: settings.bankAccountNumber || '',
    iban: settings.bankIban || '',
    branch: settings.bankBranch || '',
    instructions: settings.bankPaymentInstructions || '',
  }
  if (auth.session.role === 'customer' && !bankAccount.active) return NextResponse.json({ bankAccount: null })
  return NextResponse.json({ bankAccount })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['customer'])
    if ('response' in auth) return auth.response
    const data = submissionSchema.parse(await req.json())
    if (!proofBelongsToTenant(data.proofUrl, auth.session.tenantId)) return NextResponse.json({ error: 'Upload payment proof through the secure payment-proof uploader' }, { status: 400 })
    const customer = await db.customer.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 403 })

    const payment = await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${data.invoiceId} FOR UPDATE`)
      const invoice = await tx.invoice.findFirst({ where: { id: data.invoiceId, tenantId: auth.session.tenantId, customerId: customer.id }, include: { booking: true } })
      if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 })
      if (invoice.booking?.status !== 'completed') throw new Error('Bank transfer is available only after the booking is Completed')
      const remaining = Math.max(0, invoice.totalAmount - invoice.paidAmount)
      if (remaining <= 0) throw new Error('This invoice has no outstanding payable amount')
      if (data.amount > remaining + 0.001) throw new Error(`Transfer amount cannot exceed the remaining payable amount of ${remaining}`)
      if (await tx.payment.findFirst({ where: { invoiceId: invoice.id, method: 'bank_transfer', status: 'under_verification' } })) throw new Error('A bank transfer is already under verification')
      if (await tx.payment.findFirst({ where: { tenantId: auth.session.tenantId, referenceNo: data.referenceNo, status: { not: 'rejected' } } })) throw new Error('This transaction/reference number has already been submitted')
      return tx.payment.create({
        data: {
          tenantId: auth.session.tenantId,
          invoiceId: invoice.id,
          amount: data.amount,
          method: 'bank_transfer',
          referenceNo: data.referenceNo,
          proofUrl: data.proofUrl,
          status: 'under_verification',
          selectedBy: auth.session.userId,
          customerBankName: data.customerBankName,
          accountHolderName: data.accountHolderName,
          transferDate: data.transferDate,
          submittedAt: new Date(),
          notes: data.notes,
        },
        include: { invoice: { include: { booking: { select: { bookingNo: true } } } } },
      })
    })

    try {
      const admins = await db.user.findMany({ where: { tenantId: auth.session.tenantId, role: 'admin', status: 'active' }, select: { id: true } })
      await db.notification.createMany({ data: admins.map(admin => ({ tenantId: auth.session.tenantId, userId: admin.id, title: 'Bank transfer verification required', message: `Bank transfer ${payment.referenceNo} for booking ${payment.invoice.booking?.bookingNo || payment.invoice.invoiceNo} requires verification. Amount: ${payment.amount}.`, type: 'warning', channel: 'in_app', deliveryStatus: 'sent', deliveryAttemptedAt: new Date() })) })
    } catch (error) { console.error('Bank transfer admin notification failed', error) }
    broadcast('payment:created', { paymentId: payment.id, status: payment.status })
    return NextResponse.json(payment, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid transfer details' }, { status: 400 })
    return NextResponse.json({ error: error.message || 'Bank transfer submission failed' }, { status: error.status || 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin'])
    if ('response' in auth) return auth.response
    const data = decisionSchema.parse(await req.json())
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Payment" WHERE id = ${data.paymentId} FOR UPDATE`)
      const payment = await tx.payment.findFirst({ where: { id: data.paymentId, tenantId: auth.session.tenantId, method: 'bank_transfer' }, include: { invoice: { include: { customer: true, booking: true } } } })
      if (!payment) throw Object.assign(new Error('Bank transfer not found'), { status: 404 })
      if (payment.status !== 'under_verification') throw new Error('Only a payment under verification can be approved or rejected')
      const now = new Date()
      if (data.decision === 'reject') {
        const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: 'rejected', verifiedBy: auth.session.userId, rejectedAt: now, decisionRemarks: data.remarks } })
        return { payment: updated, customerUserId: payment.invoice.customer.userId, bookingNo: payment.invoice.booking?.bookingNo, approved: false }
      }
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${payment.invoiceId} FOR UPDATE`)
      const remaining = payment.invoice.totalAmount - payment.invoice.paidAmount
      if (payment.amount > remaining + 0.001) throw new Error('Payment exceeds the current invoice balance and cannot be approved')
      const paidAmount = payment.invoice.paidAmount + payment.amount
      await tx.invoice.update({ where: { id: payment.invoiceId }, data: { paidAmount, status: paidAmount + 0.001 >= payment.invoice.totalAmount ? 'paid' : 'partially_paid' } })
      const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: 'verified', verifiedBy: auth.session.userId, verifiedAt: now, decisionRemarks: data.remarks } })
      return { payment: updated, customerUserId: payment.invoice.customer.userId, bookingNo: payment.invoice.booking?.bookingNo, approved: true }
    })
    try {
      await db.notification.create({ data: { tenantId: auth.session.tenantId, userId: result.customerUserId, title: result.approved ? 'Bank transfer approved' : 'Bank transfer rejected', message: result.approved ? `Your bank transfer for booking ${result.bookingNo || ''} has been approved.` : `Your bank transfer for booking ${result.bookingNo || ''} was rejected. You may submit corrected details. Remarks: ${data.remarks}`, type: result.approved ? 'success' : 'error', channel: 'in_app', deliveryStatus: 'sent', deliveryAttemptedAt: new Date() } })
    } catch (error) { console.error('Bank transfer customer notification failed', error) }
    broadcast('payment:updated', { paymentId: result.payment.id, status: result.payment.status })
    return NextResponse.json(result.payment)
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid decision' }, { status: 400 })
    return NextResponse.json({ error: error.message || 'Bank transfer decision failed' }, { status: error.status || 400 })
  }
}
