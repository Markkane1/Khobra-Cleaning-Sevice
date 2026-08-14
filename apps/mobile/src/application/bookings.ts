import type { BookingGateway } from './ports'
import type { Booking, CreateBookingInput } from '../domain/bookings/types'

export function loadBookings(gateway: BookingGateway, token: string): Promise<Booking[]> {
  return gateway.getBookings(token)
}

export function createBooking(gateway: BookingGateway, input: CreateBookingInput, token: string): Promise<Booking> {
  if (!input.customerId || input.serviceIds.length === 0 || !input.scheduledDate || !input.startTime || !input.endTime) {
    return Promise.reject(new Error('Complete all required booking fields.'))
  }
  const minutes = (value: string) => { const [hours, mins] = value.split(':').map(Number); return hours * 60 + mins }
  if (minutes(input.endTime) - minutes(input.startTime) < 120) {
    return Promise.reject(new Error('Bookings require at least 2 hours.'))
  }
  return gateway.createBooking(input, token)
}
