import type { BookingGateway } from './ports'
import type { Booking, CreateBookingInput } from '../domain/bookings/types'

export function loadBookings(gateway: BookingGateway, token: string): Promise<Booking[]> {
  return gateway.getBookings(token)
}

export function createBooking(gateway: BookingGateway, input: CreateBookingInput, token: string): Promise<Booking> {
  if (!input.customerId || !input.serviceId || !input.scheduledDate || !input.startTime || !input.endTime) {
    return Promise.reject(new Error('Complete all required booking fields.'))
  }
  return gateway.createBooking(input, token)
}
