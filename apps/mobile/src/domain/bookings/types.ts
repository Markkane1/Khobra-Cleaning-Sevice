export interface Booking {
  id: string
  bookingNo: string
  scheduledDate: string
  startTime: string
  endTime: string
  status: string
  totalAmount: number
  netAmount: number
  currency: string
  discount?: number
  materialsCost?: number
  customer?: { name?: string; user?: { name?: string } }
  driverId?: string | null
  driver?: { user?: { name?: string } }
  service?: { name?: string }
  completionTimingResponses?: CompletionTimingResponse[]
  assignments?: Array<{ id: string; employeeId: string; customerRating?: number | null; employee?: { user?: { name?: string } } }>
  rating?: { overallRating: number; comment?: string | null; submittedAt: string } | null
  invoices?: Array<{ id: string; totalAmount: number; paidAmount: number; selectedPaymentMethod?: 'cash' | 'bank_transfer' | null; paymentSelectedBy?: string | null; paymentSelectedAt?: string | null; payments?: Array<{ id: string; method: 'cash' | 'bank_transfer'; status: string; reconciliationStatus?: string; selectedBy?: string; receivedBy?: string; receivedAt?: string; verifiedAt?: string; createdAt: string }> }>
}

export interface CleanerRatingInput {
  employeeId: string
  rating: number
}

export interface CompletionTimingResponse {
  id: string
  bookingId: string
  employeeId: string
  withinScheduledTime: boolean
  createdAt: string
  employee?: { user?: { name?: string } }
}

export interface PickupAlert {
  id: string
  bookingId: string
  customerLocation: string
  scheduledEndTime?: string | null
  assignedCleanerNames: string
  generatedAt: string
  viewedAt?: string | null
  booking: { bookingNo: string }
}

export interface DriverTrip {
  id: string
  date: string
  status: string
  stops?: Array<{ id: string; type?: string; address?: string; status: string }>
}

export interface CreateBookingInput {
  customerId: string
  serviceIds: string[]
  scheduledDate: string
  startTime: string
  endTime: string
  address?: string
}

export interface CompanyBankAccount {
  id: string
  accountTitle: string
  bankName: string
  accountNumber: string
  iban?: string | null
  branchName?: string | null
  branchCode?: string | null
  currency: string
  instructions?: string | null
  isDefault: boolean
}

export interface BankTransferInput {
  bookingId: string
  companyBankAccountId: string
  referenceNo: string
  customerBankName: string
  accountHolderName: string
  transferDate: string
  transferAmount: number
  proofUrl: string
  remarks?: string
}
