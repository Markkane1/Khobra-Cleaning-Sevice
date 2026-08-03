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
  method: z.enum(['cash', 'bank_transfer'], { required_error: 'Payment method is required' }),
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

