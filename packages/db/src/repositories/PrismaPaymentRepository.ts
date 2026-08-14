import { IPaymentRepository } from '@repo/application';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createTransactionSnapshot } from '../transaction-snapshot';
import { invoiceAmountsFromBooking } from '@repo/core';

const money = (value: Prisma.Decimal | number | null | undefined) => Number(value || 0)

export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPayments(tenantId: string): Promise<any[]> {
    const payments = await this.prisma.payment.findMany({
      where: { tenantId },
      include: {
        transactionSnapshot: true,
        events: { orderBy: { occurredAt: 'asc' } },
        invoice: {
          include: {
            customer: { include: { user: { select: { id: true, name: true } } } },
            booking: { include: { items: { include: { service: { select: { name: true } } } }, materials: true, assignments: { select: { id: true } } } },
            payments: { select: { id: true, amount: true, status: true, receivedAt: true, verifiedAt: true, createdAt: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const actorIds = payments.flatMap(payment => [payment.selectedBy, payment.receivedBy, payment.verifiedBy, ...payment.events.map(event => event.actorId)]).filter(Boolean) as string[];
    const [users, cleaners] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }),
      this.prisma.employee.findMany({ where: { tenantId, userId: { in: actorIds } }, select: { userId: true } }),
    ]);
    const names = new Map(users.map(user => [user.id, user.name]));
    return payments.map(payment => {
      const { payments: invoicePayments, ...invoice } = payment.invoice;
      const booking = invoice.booking;
      const invoiceSubtotal = money(invoice.subtotal), invoiceTotal = money(invoice.totalAmount), paymentAmount = money(payment.amount)
      const transactionDate = payment.receivedAt || payment.verifiedAt || payment.createdAt;
      const serviceAmount = booking ? Math.round((booking.items.length ? booking.items.reduce((sum, item) => sum + money(item.totalAmount), 0) : money(booking.hourlyRate) * booking.employeeCount * booking.duration) * 100) / 100 : invoiceSubtotal;
      const materialCharges = booking ? Math.round((booking.materials.length ? booking.materials.reduce((sum, item) => sum + money(item.totalAmount), 0) : money(booking.materialsCost)) * 100) / 100 : 0;
      const discount = money(booking?.discount || invoice.discount);
      const tax = booking ? Math.max(0, Math.round((money(booking.totalAmount) - serviceAmount - materialCharges) * 100) / 100) : money(invoice.taxAmount);
      const additionalCharges = Math.round((materialCharges + invoiceTotal - (serviceAmount + materialCharges + tax - discount)) * 100) / 100;
      const priorPaid = invoicePayments
        .filter(item => item.id !== payment.id && ['paid', 'verified'].includes(item.status) && (item.receivedAt || item.verifiedAt || item.createdAt) < transactionDate)
        .reduce((sum, item) => sum + money(item.amount), 0);
      const remainingAfter = Math.max(0, Math.round((invoiceTotal - priorPaid - paymentAmount) * 100) / 100);
      let companyBankAccount: Record<string, any> | null = null;
      try { companyBankAccount = payment.companyBankAccountSnapshot ? JSON.parse(payment.companyBankAccountSnapshot) : null; } catch { /* Preserve transaction even if a legacy snapshot is malformed. */ }
      const detailTotal = Math.round((serviceAmount + additionalCharges + tax - discount - priorPaid - remainingAfter) * 100) / 100;
      const actorName = (id: string | null) => id ? names.get(id) || id : 'System';
      const inferredHistory = [
        { event: 'Transaction record created', status: 'pending', date: payment.createdAt, actor: actorName(payment.selectedBy || payment.receivedBy || payment.verifiedBy) },
        payment.method === 'bank_transfer' && payment.submittedAt ? { event: 'Bank transfer submitted', status: 'under_verification', date: payment.submittedAt, actor: actorName(payment.selectedBy) } : null,
        payment.method === 'cash' && payment.receivedAt ? { event: 'Cash received', status: 'paid', date: payment.receivedAt, actor: actorName(payment.receivedBy) } : null,
        payment.method === 'bank_transfer' && payment.verifiedAt && ['paid', 'verified'].includes(payment.status) ? { event: 'Bank transfer approved', status: 'paid', date: payment.verifiedAt, actor: actorName(payment.verifiedBy) } : null,
        payment.method === 'cash' && payment.verifiedAt && payment.reconciliationStatus === 'reconciled' ? { event: 'Cash reconciled', status: 'verified', date: payment.verifiedAt, actor: actorName(payment.verifiedBy) } : null,
        payment.rejectedAt ? { event: 'Payment rejected', status: 'rejected', date: payment.rejectedAt, actor: actorName(payment.verifiedBy) } : null,
      ].filter(Boolean).sort((a, b) => a!.date.getTime() - b!.date.getTime());
      const history = payment.events.length ? payment.events.map(event => ({ event: event.event, status: event.status, date: event.occurredAt, actor: actorName(event.actorId) })) : inferredHistory;
      const snapshot = payment.transactionSnapshot?.snapshotData as Record<string, any> | undefined;
      return {
        ...payment,
        invoice,
        receivedByName: payment.receivedBy ? names.get(payment.receivedBy) || payment.receivedBy : null,
        verifiedByName: payment.verifiedBy ? names.get(payment.verifiedBy) || payment.verifiedBy : null,
        master: {
          transactionNumber: payment.transactionNo || `LEGACY-${payment.id.slice(-8).toUpperCase()}`,
          paymentReference: payment.referenceNo,
          bookingReference: booking?.bookingNo || null,
          customer: invoice.customer.user.name,
          paymentMethod: payment.method,
          transactionDate,
          totalAmount: paymentAmount,
          currency: companyBankAccount?.currency || 'AED',
          transactionStatus: payment.status,
          reconciliationStatus: payment.reconciliationStatus,
          cleanerCollectingCash: payment.method === 'cash' && payment.receivedBy && cleaners.some(cleaner => cleaner.userId === payment.receivedBy) ? names.get(payment.receivedBy) || payment.receivedBy : null,
          companyBankAccount: payment.method === 'bank_transfer' ? companyBankAccount : null,
          approvedBy: payment.method === 'bank_transfer' && payment.verifiedBy ? names.get(payment.verifiedBy) || payment.verifiedBy : null,
          remarks: payment.decisionRemarks || payment.notes || null,
        },
        details: {
          services: snapshot?.services || booking?.items.map(item => ({ name: item.service.name, hourlyRate: item.hourlyRate, employeeCount: item.employeeCount, hours: item.hours, amount: item.totalAmount })) || [],
          bookingServiceAmount: snapshot?.serviceAmount ?? serviceAmount,
          hourlyRate: money(booking?.hourlyRate),
          assignedEmployees: booking?.assignments.length || 0,
          totalBillableHours: booking ? Math.round(((booking.items.length ? booking.items.reduce((sum, item) => sum + item.hours * item.employeeCount, 0) : booking.duration * booking.employeeCount)) * 100) / 100 : 0,
          additionalCharges: snapshot?.materials ?? additionalCharges,
          discount: snapshot?.discount ?? discount,
          tax: snapshot?.taxAmount ?? tax,
          priorAmountPaid: Math.round(priorPaid * 100) / 100,
          remainingAfterTransaction: remainingAfter,
          finalAmountReceived: paymentAmount,
          detailTotal: snapshot ? snapshot.amountReceived : detailTotal,
        },
        bookingInformation: booking ? { reference: booking.bookingNo, status: booking.status, scheduledDate: booking.scheduledDate, startTime: booking.startTime, endTime: booking.endTime, address: booking.address, city: booking.city, area: booking.area } : null,
        customerInformation: { name: invoice.customer.user.name, phone: invoice.customer.phone, address: invoice.customer.address, city: invoice.customer.city, area: invoice.customer.area },
        bankTransferDetails: payment.method === 'bank_transfer' ? { referenceNumber: payment.referenceNo, customerBankName: payment.customerBankName, accountHolderName: payment.accountHolderName, transferDate: payment.transferDate, submittedAt: payment.submittedAt, proofUrl: payment.proofUrl } : null,
        approvalInformation: payment.verifiedBy ? { approvedBy: actorName(payment.verifiedBy), approvedAt: payment.verifiedAt, remarks: payment.decisionRemarks } : null,
        history,
      };
    });
  }

  async createPayment(tenantId: string, recordedBy: string, data: any): Promise<any> {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${data.invoiceId} FOR UPDATE`);
      const invoice = await tx.invoice.findFirst({ where: { id: data.invoiceId, tenantId } });
      if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
      if (invoice.status === 'cancelled') throw new Error('Cancelled invoices cannot receive payments');
      const remaining = Math.max(0, Math.round((money(invoice.totalAmount) - money(invoice.paidAmount)) * 100) / 100);
      if (remaining <= 0) throw new Error('Invoice is already fully paid');
      if (data.amount > remaining + 0.001) throw new Error(`Payment cannot exceed the remaining balance of ${remaining}`);
      if (await tx.payment.findFirst({ where: { tenantId, referenceNo: data.referenceNo } })) throw new Error('This transaction reference has already been recorded');
      const now = new Date();
      const paidAmount = money(invoice.paidAmount) + data.amount;
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: data.amount,
          method: data.method,
          referenceNo: data.referenceNo,
          proofUrl: data.proofUrl,
          status: 'verified',
          reconciliationStatus: data.method === 'cash' ? 'reconciled' : 'not_required',
          receivedBy: recordedBy,
          receivedAt: now,
          verifiedBy: recordedBy,
          verifiedAt: now,
          submittedAt: data.method === 'bank_transfer' ? now : null,
          notes: data.notes || 'Payment recorded by Finance',
        },
        include: { invoice: { include: { booking: { select: { id: true, bookingNo: true } } } } },
      });
      await tx.invoice.update({ where: { id: invoice.id }, data: { paidAmount, status: paidAmount + 0.001 >= money(invoice.totalAmount) ? 'paid' : 'partially_paid' } });
      return payment;
    });
  }

  async selectPaymentMethod(tenantId: string, userId: string, data: any): Promise<any> {
    const { bookingId, method } = data;

    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } }, customer: true, items: { select: { totalAmount: true } } },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.customer.userId !== userId) {
        throw Object.assign(new Error('Customers may select a payment method only for their own booking'), { status: 403 });
      }

      if (booking.status !== 'completed') {
        throw new Error('Payment selection is available only after the booking is Completed');
      }

      let invoice = booking.invoices[0];
      if (!invoice) {
        const invoiceNo = `INV-${booking.bookingNo}`;
        invoice = await tx.invoice.create({
          data: {
            tenantId,
            invoiceNo,
            bookingId: booking.id,
            customerId: booking.customerId,
            status: 'issued',
            issuedAt: new Date(),
            ...invoiceAmountsFromBooking(booking),
            paidAmount: 0,
          },
          include: { payments: { orderBy: { createdAt: 'desc' } } },
        });
      }

      const remainingPayable = Math.max(0, Math.round((money(invoice.totalAmount) - money(invoice.paidAmount)) * 100) / 100);
      if (remainingPayable <= 0) {
        throw new Error('This booking has no outstanding payable amount');
      }

      const existingVerifiedPayment = invoice.payments.find(p => p.status === 'verified' || p.status === 'paid');
      if (existingVerifiedPayment) {
        throw new Error('Payment for this booking has already been verified and locked. An Admin must reopen the payment before changing the payment method.');
      }


      await tx.payment.updateMany({
        where: { invoiceId: invoice.id, status: { in: ['payment_pending', 'cash_selected', 'bank_transfer_submitted', 'under_verification'] } },
        data: { status: 'rejected', rejectedAt: new Date(), decisionRemarks: 'Superseded by a new customer payment-method selection' },
      });

      return tx.invoice.update({
        where: { id: invoice.id },
        data: { selectedPaymentMethod: method, paymentSelectedBy: userId, paymentSelectedAt: new Date() },
        include: { booking: { select: { bookingNo: true } } },
      });
    });
  }

  async reopenPayment(tenantId: string, adminUserId: string, bookingId: string, reason?: string): Promise<any> {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { invoices: { include: { payments: true } } },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      let invoice = booking.invoices[0];
      if (!invoice) {
        throw new Error('No invoice found for this booking');
      }
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${invoice.id} FOR UPDATE`);
      invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });

      const latestPayment = [...invoice.payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (!latestPayment || latestPayment.status === 'rejected') throw new Error('There is no locked payment to reopen');
      const reversedAmount = ['verified', 'paid'].includes(latestPayment.status) ? money(latestPayment.amount) : 0;
      await tx.payment.update({
        where: { id: latestPayment.id },
        data: { status: 'rejected', rejectedAt: new Date(), verifiedBy: adminUserId, decisionRemarks: reason || 'Payment reopened by Admin' },
      });

      const paidAmount = Math.max(0, money(invoice.paidAmount) - reversedAmount);
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: paidAmount > 0 ? 'partially_paid' : 'issued',
          paidAmount,
          selectedPaymentMethod: null,
          paymentSelectedBy: null,
          paymentSelectedAt: null,
        },
      });

      return { success: true, bookingId, invoiceId: invoice.id, reopenedBy: adminUserId };
    });
  }

  async verifyCashPayment(tenantId: string, adminUserId: string, paymentId: string, remarks?: string): Promise<any> {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`);
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId, method: 'cash' },
      });

      if (!payment) {
        throw new Error('Cash payment record not found');
      }

      if (payment.status === 'verified') {
        throw new Error('Payment is already verified');
      }
      if (payment.status !== 'paid' || !payment.receivedBy || !payment.receivedAt) throw new Error('Cash must be received by an assigned cleaner before reconciliation');

      const now = new Date();
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'verified',
          reconciliationStatus: 'reconciled',
          verifiedBy: adminUserId,
          verifiedAt: now,
          decisionRemarks: remarks || 'Cash reconciled by Admin',
        },
      });
      await tx.paymentEvent.create({ data: { tenantId, paymentId: payment.id, event: 'Cash reconciled', status: 'verified', actorId: adminUserId, remarks } });
      return updated;
    });
  }

  async cleanerReceiveCash(tenantId: string, cleanerUserId: string, bookingId: string, remarks?: string): Promise<any> {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: {
          assignments: { include: { employee: { select: { id: true, userId: true, user: { select: { name: true } } } } } },
          invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } },
          customer: { include: { user: { select: { name: true } } } },
          tenant: { select: { currency: true } },
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new Error('Cash can only be received for completed bookings');
      }

      const assignedAssignment = booking.assignments.find(
        a => a.employee?.userId === cleanerUserId || a.employeeId === cleanerUserId
      );

      if (!assignedAssignment) {
        throw Object.assign(new Error('Only a cleaner assigned to this booking can mark cash as received'), { status: 403 });
      }

      let invoice = booking.invoices[0];
      if (!invoice) throw new Error('Customer must select Pay Cash before cash can be received');
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${invoice.id} FOR UPDATE`);
      invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: { orderBy: { createdAt: 'desc' } } } });

      const existingPaid = money(invoice.paidAmount);
      const remainingPayable = Math.max(0, Math.round((money(invoice.totalAmount) - existingPaid) * 100) / 100);

      if (remainingPayable <= 0) {
        throw new Error('Cash payment has already been completed for this booking');
      }

      const legacyCashSelection = invoice.payments?.find(p => p.method === 'cash' && p.status === 'cash_selected');
      const existingPayment = invoice.payments?.find(p => p.method === 'cash' && (p.status === 'verified' || p.status === 'paid'));
      if (existingPayment) {
        throw new Error('Cash payment has already been recorded and confirmed');
      }
      if (invoice.selectedPaymentMethod !== 'cash' && !legacyCashSelection) throw new Error('Customer must select Pay Cash before cash can be received');

      const now = new Date();
      const cleanerName = assignedAssignment.employee?.user?.name || 'Cleaner';

      if (legacyCashSelection && Math.abs(money(legacyCashSelection.amount) - remainingPayable) > 0.001) throw new Error('Collectible amount changed. Ask the customer or Admin to reselect the payment method');
      const paymentData = {
        transactionNo: legacyCashSelection?.transactionNo || `TXN-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
        status: 'paid', reconciliationStatus: 'pending', receivedBy: cleanerUserId, receivedAt: now, verifiedBy: null, verifiedAt: null,
        notes: `${legacyCashSelection?.notes || 'Cash payment'}; ${remarks || `Cash received by cleaner ${cleanerName} (${assignedAssignment.employeeId}) on ${now.toISOString()}`}`,
      };
      const include = {
        include: {
          invoice: {
            include: {
              booking: { select: { id: true, bookingNo: true } },
              customer: { include: { user: { select: { name: true } } } },
            },
          },
        },
      } as const;
      const payment = legacyCashSelection
        ? await tx.payment.update({ where: { id: legacyCashSelection.id }, data: paymentData, ...include })
        : await tx.payment.create({ data: { tenantId, invoiceId: invoice.id, amount: remainingPayable, method: 'cash', referenceNo: `CASH-${randomUUID()}`, selectedBy: invoice.paymentSelectedBy, ...paymentData }, ...include });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: existingPaid + remainingPayable,
          status: existingPaid + remainingPayable + 0.001 >= money(invoice.totalAmount) ? 'paid' : 'partially_paid',
          selectedPaymentMethod: null,
          paymentSelectedBy: null,
          paymentSelectedAt: null,
        },
      });
      await tx.paymentEvent.create({ data: { tenantId, paymentId: payment.id, event: 'Cash received', status: 'paid', actorId: cleanerUserId, remarks } });
      await createTransactionSnapshot(tx, tenantId, payment.id);

      return {
        payment,
        bookingNo: booking.bookingNo,
        customerName: booking.customer?.user?.name || 'Customer',
        amountReceived: remainingPayable,
        currency: booking.tenant.currency,
        cleanerName,
        receivedAt: now,
      };
    });
  }

  async getCompanyBankAccounts(tenantId: string, adminMode: boolean = false): Promise<any[]> {
    const accounts = await this.prisma.companyBankAccount.findMany({
      where: { tenantId, isDeleted: false, ...(adminMode ? {} : { isActive: true }) },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (adminMode) return accounts;
    return accounts.map(({ createdBy, updatedBy, activatedBy, deactivatedBy, deletedBy, createdAt, updatedAt, activatedAt, deactivatedAt, deletedAt, isDeleted, ...safe }) => safe);
  }

  async saveCompanyBankAccount(tenantId: string, userId: string, data: any): Promise<any> {
    const now = new Date();
    const isNew = !data.id;
    const existing = data.id ? await this.prisma.companyBankAccount.findFirst({ where: { id: data.id, tenantId, isDeleted: false } }) : null;
    if (!isNew && !existing) throw new Error('Company bank account not found');
    const normalizedCurrency = String(data.currency || 'AED').toUpperCase();
    const canonicalAccountNumber = String(data.accountNumber).replace(/[\s-]/g, '').toUpperCase();
    const candidates = await this.prisma.companyBankAccount.findMany({ where: { tenantId, currency: normalizedCurrency, isDeleted: false, ...(data.id ? { id: { not: data.id } } : {}) } });
    const duplicate = candidates.find(a => a.accountNumber.replace(/[\s-]/g, '').toUpperCase() === canonicalAccountNumber || (data.iban && a.iban === data.iban));
    if (duplicate) throw new Error('An account with this account number or IBAN already exists for the selected currency');
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
    const activationChanged = Boolean(existing && existing.isActive !== isActive);
    const values = {
      accountTitle: data.accountTitle,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      iban: data.iban || null,
      branchName: data.branchName || null,
      branchCode: data.branchCode || null,
      currency: normalizedCurrency,
      instructions: data.instructions || null,
      displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : parseInt(data.displayOrder || '0', 10),
      isActive,
      isDefault: isActive && Boolean(data.isDefault),
      updatedBy: userId,
      ...(isNew ? { createdBy: userId } : {}),
      ...((isNew && isActive) || (activationChanged && isActive) ? { activatedBy: userId, activatedAt: now } : {}),
      ...(activationChanged && !isActive ? { deactivatedBy: userId, deactivatedAt: now } : {}),
    };
    return this.prisma.$transaction(async tx => {
      if (values.isDefault) await tx.companyBankAccount.updateMany({ where: { tenantId, currency: normalizedCurrency, isDeleted: false }, data: { isDefault: false, updatedBy: userId } });
      return isNew
        ? tx.companyBankAccount.create({ data: { tenantId, isDeleted: false, ...values, createdBy: userId } })
        : tx.companyBankAccount.update({ where: { id: existing!.id, tenantId }, data: values });
    });
  }

  async toggleCompanyBankAccountActive(tenantId: string, userId: string, accountId: string, isActive: boolean): Promise<any> {
    const target = await this.prisma.companyBankAccount.findFirst({ where: { id: accountId, tenantId, isDeleted: false } });
    if (!target) throw new Error('Company bank account not found');
    return this.prisma.companyBankAccount.update({
      where: { id: target.id, tenantId },
      data: { isActive, isDefault: isActive ? target.isDefault : false, updatedBy: userId, ...(isActive ? { activatedBy: userId, activatedAt: new Date() } : { deactivatedBy: userId, deactivatedAt: new Date() }) },
    });
  }

  async deleteCompanyBankAccount(tenantId: string, userId: string, accountId: string): Promise<{ success: boolean; softDeleted: boolean; message: string }> {
    const target = await this.prisma.companyBankAccount.findFirst({ where: { id: accountId, tenantId, isDeleted: false } });
    if (!target) throw new Error('Company bank account not found');
    const referencedPayments = await this.prisma.payment.findFirst({ where: { tenantId, companyBankAccountId: accountId } });
    if (referencedPayments) {
      const now = new Date();
      await this.prisma.companyBankAccount.update({ where: { id: target.id, tenantId }, data: { isActive: false, isDefault: false, isDeleted: true, updatedBy: userId, deactivatedBy: userId, deactivatedAt: now, deletedBy: userId, deletedAt: now } });
      return { success: true, softDeleted: true, message: 'Account is linked to historical payments and was archived.' };
    }
    await this.prisma.companyBankAccount.delete({ where: { id: target.id, tenantId } });
    return { success: true, softDeleted: false, message: 'Company bank account deleted successfully.' };
  }
}
