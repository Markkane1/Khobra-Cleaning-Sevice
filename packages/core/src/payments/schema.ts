import { z } from 'zod';

export const PAYMENT_STATUS_KEYS = [
  'payment_pending',
  'cash_selected',
  'bank_transfer_submitted',
  'under_verification',
  'paid',
  'rejected',
] as const;

export type PaymentStatusKey = typeof PAYMENT_STATUS_KEYS[number];

export const CreatePaymentSchema = z.object({
  invoiceId: z.string(),
  amount: z.number(),
  method: z.string(),
  status: z.string().optional(),
}).catchall(z.any());

export type CreatePaymentDTO = z.infer<typeof CreatePaymentSchema>;

export const SelectPaymentMethodSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  method: z.enum(['cash', 'bank_transfer']),
  customerBankName: z.string().trim().optional(),
  accountHolderName: z.string().trim().optional(),
  referenceNo: z.string().trim().optional(),
  transferDate: z.coerce.date().optional(),
  proofUrl: z.string().optional(),
  notes: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.method === 'bank_transfer') {
    if (!data.referenceNo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Transaction/reference number is required for bank transfer', path: ['referenceNo'] });
    }
    if (!data.customerBankName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Customer bank name is required for bank transfer', path: ['customerBankName'] });
    }
    if (!data.accountHolderName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Account-holder name is required for bank transfer', path: ['accountHolderName'] });
    }
    if (!data.proofUrl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Payment proof is required for bank transfer', path: ['proofUrl'] });
    }
  }
});

export type SelectPaymentMethodDTO = z.infer<typeof SelectPaymentMethodSchema>;

export const ReopenPaymentSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  reason: z.string().trim().optional(),
});

export type ReopenPaymentDTO = z.infer<typeof ReopenPaymentSchema>;

export const SubmitBankTransferSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  referenceNo: z.string().trim().min(1, 'Transaction/reference number is required'),
  customerBankName: z.string().trim().min(1, 'Customer bank name is required'),
  accountHolderName: z.string().trim().min(1, 'Account holder name is required'),
  transferDate: z.coerce.date(),
  transferAmount: z.number().positive('Transfer amount must be greater than zero'),
  proofUrl: z.string().min(1, 'Payment proof is required'),
  remarks: z.string().trim().optional(),
});

export type SubmitBankTransferDTO = z.infer<typeof SubmitBankTransferSchema>;

export const AdminBankTransferDecisionSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  decision: z.enum(['approve', 'reject']),
  remarks: z.string().trim().optional(),
});

export type AdminBankTransferDecisionDTO = z.infer<typeof AdminBankTransferDecisionSchema>;

export const CompanyBankAccountSchema = z.object({
  id: z.string().optional(),
  accountTitle: z.string().trim().min(1, 'Account title is required'),
  bankName: z.string().trim().min(1, 'Bank name is required'),
  accountNumber: z.string().trim().min(1, 'Account number is required'),
  iban: z.string().trim().optional(),
  branchName: z.string().trim().optional(),
  branchCode: z.string().trim().optional(),
  currency: z.string().trim().default('AED'),
  instructions: z.string().trim().optional(),
  displayOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isDeleted: z.boolean().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CompanyBankAccountDTO = z.infer<typeof CompanyBankAccountSchema>;

export function filterActiveBankAccounts(accounts: CompanyBankAccountDTO[] = []): CompanyBankAccountDTO[] {
  return accounts
    .filter(a => a.isActive !== false && !a.isDeleted)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export function enforceSingleDefaultBankAccount(accounts: CompanyBankAccountDTO[], targetId?: string, currency: string = 'AED'): CompanyBankAccountDTO[] {
  return accounts.map(account => {
    if (account.currency === currency && account.id !== targetId) {
      return { ...account, isDefault: false };
    }
    return account;
  });
}

export interface BookingFinancialBreakdown {
  bookingAmount: number;
  discount: number;
  materialsCost: number;
  taxAmount: number;
  totalAdjustments: number;
  netAmount: number;
  paidAmount: number;
  remainingPayableAmount: number;
  isCompleted: boolean;
  canSelectPaymentMethod: boolean;
  paymentStatus: string;
  selectedPaymentMethod: string | null;
}

export function calculateBookingFinancials(booking: {
  status: string;
  totalAmount: number;
  discount?: number;
  materialsCost?: number;
  netAmount: number;
  invoices?: Array<{
    paidAmount: number;
    payments?: Array<{
      status: string;
      method: string;
      selectedBy?: string | null;
      receivedBy?: string | null;
      verifiedBy?: string | null;
      verifiedAt?: Date | string | null;
      createdAt?: Date | string;
    }>;
  }>;
}): BookingFinancialBreakdown {
  const isCompleted = booking.status === 'completed';
  const invoice = booking.invoices && booking.invoices[0];
  const paidAmount = invoice ? (invoice.paidAmount || 0) : 0;
  const remainingPayableAmount = Math.max(0, Math.round((booking.netAmount - paidAmount) * 100) / 100);

  const payments = invoice?.payments || [];
  const latestPayment = payments[0];

  let paymentStatus = 'payment_pending';
  let selectedPaymentMethod: string | null = null;

  if (paidAmount >= booking.netAmount && booking.netAmount > 0) {
    paymentStatus = 'paid';
  } else if (latestPayment) {
    selectedPaymentMethod = latestPayment.method;
    if (latestPayment.status === 'cash_selected') {
      paymentStatus = 'cash_selected';
    } else if (latestPayment.status === 'under_verification' || latestPayment.status === 'bank_transfer_submitted') {
      paymentStatus = latestPayment.method === 'bank_transfer' ? 'bank_transfer_submitted' : 'under_verification';
    } else if (latestPayment.status === 'rejected') {
      paymentStatus = 'rejected';
    } else if (latestPayment.status === 'verified' || latestPayment.status === 'paid') {
      paymentStatus = 'paid';
    }
  }

  const isLocked = paymentStatus === 'paid';
  const canSelectPaymentMethod = isCompleted && remainingPayableAmount > 0 && !isLocked;

  const discount = booking.discount || 0;
  const materialsCost = booking.materialsCost || 0;
  const netAmount = booking.netAmount || 0;
  const bookingAmount = booking.totalAmount || 0;
  const taxAmount = Math.max(0, netAmount - (bookingAmount - discount + materialsCost));

  return {
    bookingAmount,
    discount,
    materialsCost,
    taxAmount,
    totalAdjustments: discount,
    netAmount,
    paidAmount,
    remainingPayableAmount,
    isCompleted,
    canSelectPaymentMethod,
    paymentStatus,
    selectedPaymentMethod,
  };
}

export const CleanerReceiveCashSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  remarks: z.string().trim().optional(),
});

export type CleanerReceiveCashDTO = z.infer<typeof CleanerReceiveCashSchema>;

export function canCleanerReceiveCash(
  booking: {
    status: string;
    totalAmount: number;
    netAmount: number;
    assignments?: Array<{ employeeId?: string; employee?: { userId?: string } }>;
    invoices?: Array<{
      paidAmount: number;
      payments?: Array<{
        status: string;
        method: string;
        receivedBy?: string | null;
        verifiedAt?: Date | string | null;
      }>;
    }>;
  },
  cleanerId: string
): { canReceive: boolean; remainingPayable: number; reason?: string } {
  if (booking.status !== 'completed') {
    return { canReceive: false, remainingPayable: 0, reason: 'Booking is not completed' };
  }

  const isAssigned = (booking.assignments || []).some(
    a => a.employeeId === cleanerId || a.employee?.userId === cleanerId
  );

  if (!isAssigned) {
    return { canReceive: false, remainingPayable: 0, reason: 'Cleaner is not assigned to this booking' };
  }

  const financials = calculateBookingFinancials(booking);
  if (financials.paymentStatus === 'paid' || financials.remainingPayableAmount <= 0) {
    return { canReceive: false, remainingPayable: 0, reason: 'Payment is already completed or verified' };
  }

  return { canReceive: true, remainingPayable: financials.remainingPayableAmount };
}

