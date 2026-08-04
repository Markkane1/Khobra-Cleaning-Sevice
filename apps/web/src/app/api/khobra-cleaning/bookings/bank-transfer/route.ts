import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { AdminBankTransferDecisionSchema, SubmitBankTransferSchema } from '@repo/core'
import { db } from '@repo/db'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'

const proofBelongsToTenant = (proofUrl: string, tenantId: string) => {
  try {
    const url = new URL(proofUrl)
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && Boolean(cloudName) && url.pathname.includes(`/${cloudName}/`) && url.pathname.includes(`/${tenantId}/payment-proofs/`) && /\.(jpe?g|png|webp|pdf)$/i.test(url.pathname)
  } catch {
    return false
  }
}

const getActiveBankAccount = async (tenantId: string, accountId: string) => {
  const setting = await db.appSettings.findFirst({ where: { key: `company_bank_accounts_${tenantId}` } })
  try {
    return setting?.value ? JSON.parse(setting.value).find((account: any) => account.id === accountId && account.isActive !== false && !account.isDeleted) : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['customer', 'admin'])
  if ('response' in auth) return auth.response
  const setting = await db.appSettings.findFirst({ where: { key: `company_bank_accounts_${auth.session.tenantId}` } })
  try {
    const accounts = setting?.value ? JSON.parse(setting.value) : []
    return NextResponse.json({ bankAccount: accounts.find((account: any) => account.isActive !== false && !account.isDeleted) || null })
  } catch {
    return NextResponse.json({ bankAccount: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['customer'])
    if ('response' in auth) return auth.response
    const data = SubmitBankTransferSchema.parse(await req.json())
    if (!proofBelongsToTenant(data.proofUrl, auth.session.tenantId)) return NextResponse.json({ error: 'Upload payment proof through the secure payment-proof uploader' }, { status: 400 })
    const companyBankAccount = await getActiveBankAccount(auth.session.tenantId, data.companyBankAccountId)
    if (!companyBankAccount) return NextResponse.json({ error: 'The selected company bank account is no longer active. Please select another account.' }, { status: 409 })

    const customer = await db.customer.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 403 })

    const payment = await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${data.bookingId} FOR UPDATE`)
      const booking = await tx.booking.findFirst({
        where: { id: data.bookingId, tenantId: auth.session.tenantId, customerId: customer.id },
        include: { invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } } },
      })
      if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 })
      if (booking.status !== 'completed') throw new Error('Bank transfer is available only after the booking is Completed')

      let invoice = booking.invoices[0]
      if (!invoice) {
        invoice = await tx.invoice.create({
          data: { tenantId: auth.session.tenantId, bookingId: booking.id, customerId: customer.id, invoiceNo: `INV-${booking.bookingNo}`, subtotal: booking.netAmount, taxAmount: 0, totalAmount: booking.netAmount, paidAmount: 0, status: 'issued', dueDate: new Date() },
          include: { payments: true },
        })
      }
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${invoice.id} FOR UPDATE`)
      const remaining = Math.max(0, invoice.totalAmount - invoice.paidAmount)
      if (remaining <= 0) throw new Error('This invoice has no outstanding payable amount')
      if (data.transferAmount > remaining + 0.001) throw new Error(`Transfer amount cannot exceed the remaining payable amount of ${remaining}`)
      if (invoice.payments.some(item => item.method === 'bank_transfer' && item.status === 'under_verification')) throw new Error('A bank transfer is already under verification')
      if (await tx.payment.findFirst({ where: { tenantId: auth.session.tenantId, referenceNo: data.referenceNo, status: { not: 'rejected' } } })) throw new Error('This transaction/reference number has already been submitted')

      const selected = invoice.payments.find(item => item.method === 'bank_transfer' && item.status === 'payment_pending' && item.selectedBy === auth.session.userId)
      const values = {
        amount: data.transferAmount,
        method: 'bank_transfer',
        referenceNo: data.referenceNo,
        proofUrl: data.proofUrl,
        status: 'under_verification',
        selectedBy: auth.session.userId,
        customerBankName: data.customerBankName,
        accountHolderName: data.accountHolderName,
        companyBankAccountId: data.companyBankAccountId,
        companyBankAccountSnapshot: JSON.stringify({ accountTitle: companyBankAccount.accountTitle, bankName: companyBankAccount.bankName, accountNumber: companyBankAccount.accountNumber, iban: companyBankAccount.iban || '', branchName: companyBankAccount.branchName || '', branchCode: companyBankAccount.branchCode || '', currency: companyBankAccount.currency || 'AED' }),
        transferDate: data.transferDate,
        submittedAt: new Date(),
        notes: data.remarks,
      }
      return selected
        ? tx.payment.update({ where: { id: selected.id }, data: values, include: { invoice: true } })
        : tx.payment.create({ data: { tenantId: auth.session.tenantId, invoiceId: invoice.id, ...values }, include: { invoice: true } })
    })

    try {
      const booking = await db.booking.findFirst({ where: { id: data.bookingId }, select: { bookingNo: true } })
      const admins = await db.user.findMany({ where: { tenantId: auth.session.tenantId, role: 'admin', status: 'active' }, select: { id: true } })
      if (admins.length) await db.notification.createMany({ data: admins.map(admin => ({ tenantId: auth.session.tenantId, userId: admin.id, title: 'Bank transfer verification required', message: `Booking ${booking?.bookingNo || data.bookingId}: transfer ${payment.referenceNo} for AED ${payment.amount} requires verification.`, type: 'warning', channel: 'in_app', deliveryStatus: 'sent', deliveryAttemptedAt: new Date() })) })
    } catch (error) { console.error('Bank transfer admin notification failed', error) }
    broadcast('payment:created', { paymentId: payment.id, status: payment.status, bookingId: data.bookingId })
    broadcast('booking:updated', { bookingId: data.bookingId })
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
    const data = AdminBankTransferDecisionSchema.parse(await req.json())
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Payment" WHERE id = ${data.paymentId} FOR UPDATE`)
      const payment = await tx.payment.findFirst({ where: { id: data.paymentId, tenantId: auth.session.tenantId, method: 'bank_transfer' }, include: { invoice: { include: { customer: true, booking: true } } } })
      if (!payment) throw Object.assign(new Error('Bank transfer not found'), { status: 404 })
      if (payment.status !== 'under_verification') throw new Error('Only a payment under verification can be approved or rejected')
      const now = new Date()
      if (data.decision === 'reject') {
        const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: 'rejected', verifiedBy: auth.session.userId, rejectedAt: now, decisionRemarks: data.remarks, verifiedAt: null } })
        return { payment: updated, customerUserId: payment.invoice.customer.userId, bookingNo: payment.invoice.booking?.bookingNo, bookingId: payment.invoice.bookingId, approved: false }
      }
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${payment.invoiceId} FOR UPDATE`)
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } })
      const remaining = invoice.totalAmount - invoice.paidAmount
      if (payment.amount > remaining + 0.001) throw new Error('Payment exceeds the current invoice balance and cannot be approved')
      const paidAmount = invoice.paidAmount + payment.amount
      await tx.invoice.update({ where: { id: payment.invoiceId }, data: { paidAmount, status: paidAmount + 0.001 >= invoice.totalAmount ? 'paid' : 'partially_paid' } })
      const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: 'verified', verifiedBy: auth.session.userId, verifiedAt: now, rejectedAt: null, decisionRemarks: data.remarks } })
      return { payment: updated, customerUserId: payment.invoice.customer.userId, bookingNo: payment.invoice.booking?.bookingNo, bookingId: payment.invoice.bookingId, approved: true }
    })
    try {
      await db.notification.create({ data: { tenantId: auth.session.tenantId, userId: result.customerUserId, title: result.approved ? 'Bank transfer approved' : 'Bank transfer rejected', message: result.approved ? `Your bank transfer for booking ${result.bookingNo || ''} has been approved.` : `Your bank transfer for booking ${result.bookingNo || ''} was rejected. You may submit corrected details. Remarks: ${data.remarks}`, type: result.approved ? 'success' : 'error', channel: 'in_app', deliveryStatus: 'sent', deliveryAttemptedAt: new Date() } })
    } catch (error) { console.error('Bank transfer customer notification failed', error) }
    broadcast('payment:updated', { paymentId: result.payment.id, status: result.payment.status, bookingId: result.bookingId })
    broadcast('booking:updated', { bookingId: result.bookingId })
    return NextResponse.json(result.payment)
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid decision' }, { status: 400 })
    return NextResponse.json({ error: error.message || 'Bank transfer decision failed' }, { status: error.status || 400 })
  }
}
