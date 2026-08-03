export interface Booking {
  id: string
  bookingNo: string
  scheduledDate: string
  startTime: string
  endTime: string
  status: string
  customer?: { name?: string }
  service?: { name?: string }
}

export interface CreateBookingInput {
  customerId: string
  serviceId: string
  scheduledDate: string
  startTime: string
  endTime: string
  address?: string
}
