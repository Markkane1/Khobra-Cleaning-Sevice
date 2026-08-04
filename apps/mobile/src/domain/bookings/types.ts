export interface Booking {
  id: string
  bookingNo: string
  scheduledDate: string
  startTime: string
  endTime: string
  status: string
  totalAmount: number
  netAmount: number
  discount?: number
  materialsCost?: number
  customer?: { name?: string; user?: { name?: string } }
  driverId?: string | null
  driver?: { user?: { name?: string } }
  service?: { name?: string }
  completionTimingResponses?: CompletionTimingResponse[]
  assignments?: Array<{ id: string; employeeId: string; customerRating?: number | null; employee?: { user?: { name?: string } } }>
  rating?: { overallRating: number; comment?: string | null; submittedAt: string } | null
  invoices?: Array<{ id: string; totalAmount: number; paidAmount: number; payments?: Array<{ id: string; method: 'cash' | 'bank_transfer'; status: string; selectedBy?: string; receivedBy?: string; verifiedAt?: string; createdAt: string }> }>
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

export interface CreateBookingInput {
  customerId: string
  serviceId: string
  scheduledDate: string
  startTime: string
  endTime: string
  address?: string
}
