import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { AdminBankTransferDecisionSchema, invoiceAmountsFromBooking, SubmitBankTransferSchema } from '@repo/core'
import { createTransactionSnapshot, db, deliverPushNotifications } from '@repo/db'
import { randomUUID } from 'crypto'
import { requireAuth } from '@/lib/auth'
import { broadcast } from '@/lib/broadcast'
import { apiErrorResponse } from '@/lib/api-error'

const getActiveBankAccount = async (tenantId: string, accountId: string) => {
  return db.companyBankAccount.findFirst({ where: { id: accountId, tenantId, isActive: true, isDeleted: false } })
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['customer', 'admin'])
  if ('response' in auth) return auth.response
  const bankAccount = await db.companyBankAccount.findFirst({
    where: { tenantId: auth.session.tenantId, isActive: true, isDeleted: false },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, bankName: true, accountTitle: true, accountNumber: true, iban: true, branchName: true, branchCode: true, currency: true, instructions: true, isDefault: true },
  })
  return NextResponse.json({ bankAccount })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['customer'])
    if ('response' in auth) return auth.response
    const data = SubmitBankTransferSchema.parse(await req.json())
    if (!await db.uploadAsset.findFirst({ where: { url: data.proofUrl, tenantId: auth.session.tenantId, userId: auth.session.userId, purpose: 'payment-proofs' } })) return NextResponse.json({ error: 'Payment proof was not uploaded by this customer.' }, { status: 400 })
    const companyBankAccount = await getActiveBankAccount(auth.session.tenantId, data.companyBankAccountId)
    if (!companyBankAccount) return NextResponse.json({ error: 'The selected company bank account is no longer active. Please select another account.' }, { status: 409 })

    const customer = await db.customer.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 403 })

    const payment = await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${data.bookingId} FOR UPDATE`)
      const booking = await tx.booking.findFirst({
        where: { id: data.bookingId, tenantId: auth.session.tenantId, customerId: customer.id },
        include: { invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } }, items: { select: { totalAmount: true } } },
      })
      if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 })
      if (booking.status !== 'completed') throw new Error('Bank transfer is available only after the booking is Completed')

      let invoice = booking.invoices[0]
      if (!invoice) {
        invoice = await tx.invoice.create({
          data: { tenantId: auth.session.tenantId, bookingId: booking.id, customerId: customer.id, invoiceNo: `INV-${booking.bookingNo}`, ...invoiceAmountsFromBooking(booking), paidAmount: 0, status: 'issued', dueDate: new Date() },
          include: { payments: true },
        })
      }
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${invoice.id} FOR UPDATE`)
      if (invoice.selectedPaymentMethod !== 'bank_transfer') throw new Error('Customer must select Bank Transfer before submitting transfer details')
      const remaining = Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount))
      if (remaining <= 0) throw new Error('This invoice has no outstanding payable amount')
      if (data.transferAmount > remaining + 0.001) throw new Error(`Transfer amount cannot exceed the remaining payable amount of ${remaining}`)
      if (invoice.payments.some(item => item.method === 'bank_transfer' && item.status === 'under_verification')) throw new Error('A bank transfer is already under verification')
      if (await tx.payment.findFirst({ where: { tenantId: auth.session.tenantId, referenceNo: data.referenceNo } })) throw new Error('This transaction/reference number has already been submitted')

      // SEC-015: Verify proof URL provenance matches tenant upload path
      if (!data.proofUrl.includes(auth.session.tenantId) && !data.proofUrl.includes('/uploads/')) {
        throw new Error('Payment proof URL must originate from an authenticated upload session for this tenant')
      }

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
      const payment = selected
        ? tx.payment.update({ where: { id: selected.id }, data: values, include: { invoice: true } })
        : tx.payment.create({ data: { tenantId: auth.session.tenantId, invoiceId: invoice.id, ...values }, include: { invoice: true } })
      const result = await payment
      await tx.paymentEvent.create({ data: { tenantId: auth.session.tenantId, paymentId: result.id, event: 'Bank transfer submitted', status: 'under_verification', actorId: auth.session.userId, remarks: data.remarks } })
      return result
    })

    try {
      const booking = await db.booking.findFirst({ where: { id: data.bookingId }, select: { bookingNo: true } })
      const admins = await db.user.findMany({ where: { tenantId: auth.session.tenantId, role: 'admin', status: 'active' }, select: { id: true } })
      const notices = admins.map(admin => ({ tenantId: auth.session.tenantId, userId: admin.id, deliveryKey: `bank-transfer-submitted:${payment.id}`, title: 'Bank transfer verification required', message: `Booking ${booking?.bookingNo || data.bookingId}: transfer ${payment.referenceNo} for ${companyBankAccount.currency} ${payment.amount} requires verification.`, type: 'warning' }))
      if (notices.length) {
        await db.notification.createMany({ skipDuplicates: true, data: notices.map(notice => ({ ...notice, channel: 'in_app', deliveryStatus: 'sent', deliveryAttemptedAt: new Date() })) })
        await deliverPushNotifications(db, notices)
      }
    } catch (error) { console.error('Bank transfer admin notification failed', error) }
    broadcast('payment:created', { paymentId: payment.id, status: payment.status, bookingId: data.bookingId }, auth.session.tenantId)
    broadcast('booking:updated', { bookingId: data.bookingId }, auth.session.tenantId)
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Bank transfer submission failed', missing: 'Booking, invoice, or bank account not found', conflict: 'A confirmed payment already exists for this booking', domainErrorStatus: 400 })
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
        await tx.paymentEvent.create({ data: { tenantId: auth.session.tenantId, paymentId: payment.id, event: 'Bank transfer rejected', status: 'rejected', actorId: auth.session.userId, remarks: data.remarks } })
        await tx.invoice.update({ where: { id: payment.invoiceId }, data: { selectedPaymentMethod: null, paymentSelectedBy: null, paymentSelectedAt: null } })
        return { payment: updated, customerUserId: payment.invoice.customer.userId, bookingNo: payment.invoice.booking?.bookingNo, bookingId: payment.invoice.bookingId, approved: false }
      }
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${payment.invoiceId} FOR UPDATE`)
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } })
      if (payment.invoice.booking?.status !== 'completed') throw new Error('Bank transfer can only be approved for a completed booking')
      if (invoice.selectedPaymentMethod !== 'bank_transfer' && payment.selectedBy !== payment.invoice.customer.userId) throw new Error('Bank Transfer was not selected by this booking customer')
      if (!payment.referenceNo || !payment.customerBankName || !payment.accountHolderName || !payment.transferDate || !payment.submittedAt) throw new Error('Required bank-transfer details are incomplete')
      if (!payment.proofUrl || !await tx.uploadAsset.findFirst({ where: { url: payment.proofUrl, tenantId: auth.session.tenantId, userId: payment.invoice.customer.userId, purpose: 'payment-proofs' } })) throw new Error('A valid uploaded payment proof is required')
      if (!payment.companyBankAccountId || !payment.companyBankAccountSnapshot) throw new Error('The submitted transfer is not linked to a company bank account')
      const paymentAmount = Number(payment.amount)
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('Transfer amount must be greater than zero')
      if (await tx.payment.findFirst({ where: { invoiceId: invoice.id, id: { not: payment.id }, status: { in: ['paid', 'verified'] } } })) throw new Error('A confirmed transaction already exists for this invoice')
      const remaining = Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount))
      if (remaining <= 0) throw new Error('This invoice is already fully paid')
      if (paymentAmount > remaining + 0.001) throw new Error('Payment exceeds the current invoice balance and cannot be approved')
      const paidAmount = Number(invoice.paidAmount) + paymentAmount
      await tx.invoice.update({ where: { id: payment.invoiceId }, data: { paidAmount, status: paidAmount + 0.001 >= Number(invoice.totalAmount) ? 'paid' : 'partially_paid', selectedPaymentMethod: null, paymentSelectedBy: null, paymentSelectedAt: null } })
      const updated = await tx.payment.update({ where: { id: payment.id }, data: { transactionNo: payment.transactionNo || `TXN-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`, status: 'paid', reconciliationStatus: 'not_required', receivedAt: now, verifiedBy: auth.session.userId, verifiedAt: now, rejectedAt: null, decisionRemarks: data.remarks } })
      await tx.paymentEvent.create({ data: { tenantId: auth.session.tenantId, paymentId: payment.id, event: 'Bank transfer approved', status: 'paid', actorId: auth.session.userId, remarks: data.remarks } })
      await createTransactionSnapshot(tx, auth.session.tenantId, payment.id)
      return { payment: updated, customerUserId: payment.invoice.customer.userId, bookingNo: payment.invoice.booking?.bookingNo, bookingId: payment.invoice.bookingId, approved: true }
    })
    try {
      const notice = { tenantId: auth.session.tenantId, userId: result.customerUserId, deliveryKey: `bank-transfer-decision:${result.payment.id}`, title: result.approved ? 'Bank transfer approved' : 'Bank transfer rejected', message: result.approved ? `Your bank transfer for booking ${result.bookingNo || ''} has been approved.` : `Your bank transfer for booking ${result.bookingNo || ''} was rejected. You may submit corrected details. Remarks: ${data.remarks}`, type: result.approved ? 'success' : 'error' }
      await db.notification.createMany({ skipDuplicates: true, data: [{ ...notice, channel: 'in_app', deliveryStatus: 'sent', deliveryAttemptedAt: new Date() }] })
      await deliverPushNotifications(db, [notice])
    } catch (error) { console.error('Bank transfer customer notification failed', error) }
    broadcast('payment:updated', { paymentId: result.payment.id, status: result.payment.status, bookingId: result.bookingId }, auth.session.tenantId)
    broadcast('booking:updated', { bookingId: result.bookingId }, auth.session.tenantId)
    return NextResponse.json(result.payment)
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Bank transfer decision failed', missing: 'Payment not found', conflict: 'This payment has already been decided', domainErrorStatus: 400 })
  }
}
