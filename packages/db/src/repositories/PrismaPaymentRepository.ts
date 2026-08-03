import { IPaymentRepository } from '@repo/application';
import { PrismaClient } from '@prisma/client';

export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPayments(tenantId: string): Promise<any[]> {
    return this.prisma.payment.findMany({
      where: { tenantId },
      include: { invoice: { include: { customer: { include: { user: { select: { id: true, name: true } } } }, booking: { select: { bookingNo: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPayment(tenantId: string, data: any): Promise<any> {
    return this.prisma.payment.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async updateInvoicePaymentStatus(invoiceId: string, amount: number): Promise<{ invoiceNo: string; newStatus: string } | null> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return null;
    
    const newPaid = (invoice.paidAmount || 0) + amount;
    const newStatus = newPaid >= invoice.totalAmount ? 'paid' : 'partially_paid';
    
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid, status: newStatus },
    });
    
    return { invoiceNo: invoice.invoiceNo, newStatus };
  }

  async selectPaymentMethod(tenantId: string, userId: string, data: any): Promise<any> {
    const { bookingId, method, customerBankName, accountHolderName, referenceNo, transferDate, proofUrl, notes } = data;

    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } }, customer: true },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new Error('Payment selection is available only after the booking is Completed');
      }

      let invoice = booking.invoices[0];
      if (!invoice) {
        const invCount = await tx.invoice.count({ where: { tenantId } });
        const invoiceNo = `INV-${String(1000 + invCount).padStart(5, '0')}`;
        invoice = await tx.invoice.create({
          data: {
            tenantId,
            invoiceNo,
            bookingId: booking.id,
            customerId: booking.customerId,
            status: 'issued',
            issuedAt: new Date(),
            subtotal: booking.netAmount,
            totalAmount: booking.netAmount,
            paidAmount: 0,
            discount: booking.discount || 0,
          },
          include: { payments: { orderBy: { createdAt: 'desc' } } },
        });
      }

      const remainingPayable = Math.max(0, Math.round((invoice.totalAmount - invoice.paidAmount) * 100) / 100);
      if (remainingPayable <= 0) {
        throw new Error('This booking has no outstanding payable amount');
      }

      const existingVerifiedPayment = invoice.payments.find(p => p.status === 'verified' || p.status === 'paid');
      if (existingVerifiedPayment) {
        throw new Error('Payment for this booking has already been verified and locked. An Admin must reopen the payment before changing the payment method.');
      }

      const status = method === 'cash' ? 'cash_selected' : 'under_verification';

      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: remainingPayable,
          method,
          status,
          receivedBy: userId,
          referenceNo: method === 'bank_transfer' ? referenceNo : (method === 'cash' ? `CASH-${Date.now()}` : null),
          proofUrl: method === 'bank_transfer' ? proofUrl : null,
          notes: notes || (method === 'bank_transfer' ? `Bank: ${customerBankName}, Holder: ${accountHolderName}` : 'Cash payment selected'),
        },
        include: { invoice: { include: { booking: { select: { bookingNo: true } } } } },
      });

      return payment;
    });
  }

  async reopenPayment(tenantId: string, adminUserId: string, bookingId: string, reason?: string): Promise<any> {
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { invoices: { include: { payments: true } } },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      const invoice = booking.invoices[0];
      if (!invoice) {
        throw new Error('No invoice found for this booking');
      }

      await tx.payment.updateMany({
        where: { invoiceId: invoice.id, tenantId },
        data: {
          status: 'rejected',
          notes: reason || `Payment reopened by Admin (${adminUserId})`,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'issued',
          paidAmount: 0,
        },
      });

      return { success: true, bookingId, invoiceId: invoice.id, reopenedBy: adminUserId };
    });
  }

  async verifyCashPayment(tenantId: string, adminUserId: string, paymentId: string, remarks?: string): Promise<any> {
    return this.prisma.$transaction(async tx => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId, method: 'cash' },
        include: { invoice: true },
      });

      if (!payment) {
        throw new Error('Cash payment record not found');
      }

      if (payment.status === 'verified' || payment.status === 'paid') {
        throw new Error('Payment is already verified');
      }

      const now = new Date();
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'verified',
          verifiedBy: adminUserId,
          verifiedAt: now,
          notes: remarks || 'Cash payment verified by Admin',
        },
      });

      const newPaidAmount = (payment.invoice.paidAmount || 0) + payment.amount;
      const newInvoiceStatus = newPaidAmount + 0.001 >= payment.invoice.totalAmount ? 'paid' : 'partially_paid';

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newInvoiceStatus,
        },
      });

      return updatedPayment;
    });
  }

  async cleanerReceiveCash(tenantId: string, cleanerUserId: string, bookingId: string, remarks?: string): Promise<any> {
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: {
          assignments: { include: { employee: { select: { id: true, userId: true, user: { select: { name: true } } } } } },
          invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } },
          customer: { include: { user: { select: { name: true } } } },
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
        throw new Error('Only a cleaner assigned to this booking can mark cash as received');
      }

      let invoice = booking.invoices[0];
      if (!invoice) {
        invoice = await tx.invoice.create({
          data: {
            tenantId,
            bookingId: booking.id,
            customerId: booking.customerId,
            invoiceNo: `INV-${booking.bookingNo}`,
            subtotal: booking.netAmount,
            taxAmount: 0,
            totalAmount: booking.netAmount,
            paidAmount: 0,
            status: 'issued',
            dueDate: new Date(),
          },
          include: { payments: true },
        });
      }

      const existingPaid = invoice.paidAmount || 0;
      const remainingPayable = Math.max(0, Math.round((booking.netAmount - existingPaid) * 100) / 100);

      if (remainingPayable <= 0) {
        throw new Error('Cash payment has already been completed for this booking');
      }

      const existingPayment = invoice.payments?.find(p => p.status === 'verified' || p.status === 'paid');
      if (existingPayment) {
        throw new Error('Cash payment has already been recorded and confirmed');
      }

      const now = new Date();
      const cleanerName = assignedAssignment.employee?.user?.name || 'Cleaner';

      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: remainingPayable,
          method: 'cash',
          status: 'verified',
          receivedBy: cleanerUserId,
          verifiedBy: cleanerUserId,
          verifiedAt: now,
          referenceNo: `CASH-${booking.bookingNo}-${Date.now().toString().slice(-6)}`,
          notes: remarks || `Cash received by cleaner ${cleanerName} (${assignedAssignment.employeeId}) on ${now.toISOString()}`,
        },
        include: {
          invoice: {
            include: {
              booking: { select: { bookingNo: true } },
              customer: { include: { user: { select: { name: true } } } },
            },
          },
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: booking.netAmount,
          status: 'paid',
        },
      });

      return {
        payment,
        bookingNo: booking.bookingNo,
        customerName: booking.customer?.user?.name || 'Customer',
        amountReceived: remainingPayable,
        currency: 'AED',
        cleanerName,
        receivedAt: now,
      };
    });
  }

  async getCompanyBankAccount(tenantId: string): Promise<any> {
    const settingsList = await this.prisma.appSettings.findMany({
      where: { key: { startsWith: 'bank' } },
    });
    const settings = Object.fromEntries(settingsList.map((item: any) => [item.key, item.value]));

    return {
      tenantId,
      active: true,
      accountTitle: settings.bankAccountTitle || 'Khobra Cleaning Services LLC',
      bankName: settings.bankName || 'Emirates NBD',
      accountNumber: settings.bankAccountNumber || '10154829384701',
      iban: settings.bankIban || 'AE0302000010154829384701',
      branchName: settings.bankBranch || 'Downtown Dubai Branch (Code: 020)',
      instructions: settings.bankPaymentInstructions || 'Please include your Booking Reference in the transfer memo and upload a clear screenshot or PDF of your payment receipt.',
    };
  }

  async submitBankTransfer(tenantId: string, userId: string, data: any): Promise<any> {
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findFirst({
        where: { id: data.bookingId, tenantId },
        include: { invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } } },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new Error('Bank transfer can only be submitted for completed bookings');
      }

      let invoice = booking.invoices[0];
      if (!invoice) {
        invoice = await tx.invoice.create({
          data: {
            tenantId,
            bookingId: booking.id,
            customerId: booking.customerId,
            invoiceNo: `INV-${booking.bookingNo}`,
            subtotal: booking.netAmount,
            taxAmount: 0,
            totalAmount: booking.netAmount,
            paidAmount: 0,
            status: 'issued',
            dueDate: new Date(),
          },
          include: { payments: true },
        });
      }

      const existingPaid = invoice.paidAmount || 0;
      const remainingPayable = Math.max(0, Math.round((booking.netAmount - existingPaid) * 100) / 100);

      if (remainingPayable <= 0) {
        throw new Error('This booking is already fully paid');
      }

      const now = new Date();
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: data.transferAmount || remainingPayable,
          method: 'bank_transfer',
          status: 'under_verification',
          referenceNo: data.referenceNo,
          proofUrl: data.proofUrl,
          receivedBy: userId,
          notes: `Bank: ${data.customerBankName}, Holder: ${data.accountHolderName}, Date: ${data.transferDate ? new Date(data.transferDate).toISOString() : now.toISOString()}${data.remarks ? `, Remarks: ${data.remarks}` : ''}`,
        },
        include: { invoice: { include: { booking: { select: { bookingNo: true } } } } },
      });

      return payment;
    });
  }

  async decideBankTransfer(
    tenantId: string,
    adminUserId: string,
    paymentId: string,
    decision: 'approve' | 'reject',
    remarks?: string
  ): Promise<any> {
    return this.prisma.$transaction(async tx => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId, method: 'bank_transfer' },
        include: { invoice: { include: { customer: true, booking: true } } },
      });

      if (!payment) {
        throw new Error('Bank transfer record not found');
      }

      const now = new Date();

      if (decision === 'reject') {
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'rejected',
            verifiedBy: adminUserId,
            verifiedAt: now,
            notes: remarks ? `Rejected by Admin: ${remarks}` : 'Bank transfer rejected by Admin',
          },
        });

        return {
          payment: updated,
          customerUserId: payment.invoice.customer.userId,
          bookingNo: payment.invoice.booking?.bookingNo,
          approved: false,
          remarks,
        };
      }

      const remaining = payment.invoice.totalAmount - payment.invoice.paidAmount;
      const paidAmount = payment.invoice.paidAmount + payment.amount;
      const newInvoiceStatus = paidAmount + 0.001 >= payment.invoice.totalAmount ? 'paid' : 'partially_paid';

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paidAmount,
          status: newInvoiceStatus,
        },
      });

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'verified',
          verifiedBy: adminUserId,
          verifiedAt: now,
          notes: remarks ? `Verified & Approved by Admin: ${remarks}` : 'Bank transfer verified & approved by Admin',
        },
      });

      return {
        payment: updated,
        customerUserId: payment.invoice.customer.userId,
        bookingNo: payment.invoice.booking?.bookingNo,
        approved: true,
        remarks,
      };
    });
  }

  async getCompanyBankAccounts(tenantId: string, adminMode: boolean = false): Promise<any[]> {
    const setting = await this.prisma.appSettings.findFirst({
      where: { key: `company_bank_accounts_${tenantId}` },
    });

    let accounts: any[] = [];
    if (setting?.value) {
      try {
        accounts = JSON.parse(setting.value);
      } catch {
        accounts = [];
      }
    }

    if (accounts.length === 0) {
      accounts = [
        {
          id: `acc_default_${tenantId}`,
          accountTitle: 'Khobra Cleaning Services LLC',
          bankName: 'Emirates NBD',
          accountNumber: '10154829384701',
          iban: 'AE0302000010154829384701',
          branchName: 'Downtown Dubai Branch',
          branchCode: '020',
          currency: 'AED',
          instructions: 'Please include your Booking Reference in the transfer memo and upload a clear screenshot or PDF of your payment proof.',
          displayOrder: 1,
          isActive: true,
          isDefault: true,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }

    if (!adminMode) {
      return accounts
        .filter(a => a.isActive !== false && !a.isDeleted)
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        .map(({ createdBy, updatedBy, ...customerSafe }) => customerSafe);
    }

    return accounts
      .filter(a => !a.isDeleted)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  async saveCompanyBankAccount(tenantId: string, userId: string, data: any): Promise<any> {
    const key = `company_bank_accounts_${tenantId}`;
    const setting = await this.prisma.appSettings.findFirst({ where: { key } });

    let accounts: any[] = [];
    if (setting?.value) {
      try {
        accounts = JSON.parse(setting.value);
      } catch {
        accounts = [];
      }
    }

    const now = new Date().toISOString();
    const isNew = !data.id;
    const accountId = data.id || `acc_${Date.now().toString().slice(-8)}`;

    if (data.isDefault) {
      accounts = accounts.map(a => (a.currency === (data.currency || 'AED') ? { ...a, isDefault: false } : a));
    }

    const newOrUpdatedAccount = {
      id: accountId,
      accountTitle: data.accountTitle,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      iban: data.iban || '',
      branchName: data.branchName || '',
      branchCode: data.branchCode || '',
      currency: data.currency || 'AED',
      instructions: data.instructions || '',
      displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : parseInt(data.displayOrder || '0', 10),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      isDefault: Boolean(data.isDefault),
      isDeleted: false,
      createdBy: isNew ? userId : (accounts.find(a => a.id === accountId)?.createdBy || userId),
      updatedBy: userId,
      createdAt: isNew ? now : (accounts.find(a => a.id === accountId)?.createdAt || now),
      updatedAt: now,
    };

    if (isNew) {
      accounts.push(newOrUpdatedAccount);
    } else {
      accounts = accounts.map(a => (a.id === accountId ? newOrUpdatedAccount : a));
    }

    await this.prisma.appSettings.upsert({
      where: { key },
      create: { key, value: JSON.stringify(accounts), description: 'Tenant Company Bank Accounts List' },
      update: { value: JSON.stringify(accounts) },
    });

    return newOrUpdatedAccount;
  }

  async toggleCompanyBankAccountActive(tenantId: string, userId: string, accountId: string, isActive: boolean): Promise<any> {
    const key = `company_bank_accounts_${tenantId}`;
    const setting = await this.prisma.appSettings.findFirst({ where: { key } });

    if (!setting?.value) {
      throw new Error('Company bank account not found');
    }

    let accounts: any[] = JSON.parse(setting.value);
    const target = accounts.find(a => a.id === accountId);
    if (!target) {
      throw new Error('Target company bank account not found');
    }

    target.isActive = isActive;
    target.updatedBy = userId;
    target.updatedAt = new Date().toISOString();

    await this.prisma.appSettings.update({
      where: { key },
      data: { value: JSON.stringify(accounts) },
    });

    return target;
  }

  async deleteCompanyBankAccount(tenantId: string, userId: string, accountId: string): Promise<{ success: boolean; softDeleted: boolean; message: string }> {
    const key = `company_bank_accounts_${tenantId}`;
    const setting = await this.prisma.appSettings.findFirst({ where: { key } });

    if (!setting?.value) {
      throw new Error('Company bank account not found');
    }

    let accounts: any[] = JSON.parse(setting.value);
    const targetIndex = accounts.findIndex(a => a.id === accountId);
    if (targetIndex === -1) {
      throw new Error('Company bank account not found');
    }

    const targetAccount = accounts[targetIndex];

    const referencedPayments = await this.prisma.payment.findFirst({
      where: {
        tenantId,
        method: 'bank_transfer',
        OR: [
          { referenceNo: { contains: targetAccount.accountNumber } },
          { notes: { contains: targetAccount.bankName } },
          { notes: { contains: targetAccount.accountNumber } },
        ],
      },
    });

    const now = new Date().toISOString();

    if (referencedPayments) {
      accounts[targetIndex].isActive = false;
      accounts[targetIndex].isDeleted = true;
      accounts[targetIndex].updatedBy = userId;
      accounts[targetIndex].updatedAt = now;

      await this.prisma.appSettings.update({
        where: { key },
        data: { value: JSON.stringify(accounts) },
      });

      return {
        success: true,
        softDeleted: true,
        message: 'Account is linked to historical payment transactions. It has been safely deactivated & archived to preserve transaction history.',
      };
    }

    accounts.splice(targetIndex, 1);
    await this.prisma.appSettings.update({
      where: { key },
      data: { value: JSON.stringify(accounts) },
    });

    return {
      success: true,
      softDeleted: false,
      message: 'Company bank account deleted successfully.',
    };
  }
}

