export interface Booking {
  id: string
  bookingNo: string
  scheduledDate: string
  startTime: string
  endTime: string
  status: string
  customer?: { name?: string }
  driverId?: string | null
  driver?: { user?: { name?: string } }
  service?: { name?: string }
  completionTimingResponses?: CompletionTimingResponse[]
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
