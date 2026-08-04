import type { AuthGateway, BookingGateway, DashboardGateway, OperationsGateway } from '../../application/ports'
import type { Session } from '../../domain/auth/types'
import type { Booking, CompletionTimingResponse, CreateBookingInput, PickupAlert } from '../../domain/bookings/types'
import type { OperationModule, OperationRecord } from '../../domain/operations/types'
import type { DashboardStats } from '../../domain/dashboard/types'
import { request } from './api-client'

export const khobraAuthGateway: AuthGateway = {
  signIn: (email, password, turnstileToken) => request<Session>('/api/khobra-cleaning/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, turnstileToken }),
  }),
  signUp: (input) => request<Session>('/api/khobra-cleaning/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
}

export const khobraDashboardGateway: DashboardGateway = {
  getStats: async (token) => {
    const data = await request<{ stats: DashboardStats }>('/api/khobra-cleaning/dashboard', {}, token)
    return data.stats
  },
}

export const khobraBookingGateway: BookingGateway = {
  getBookings: (token) => request<Booking[]>('/api/khobra-cleaning/bookings', {}, token),
  createBooking: (input, token) => request<Booking>('/api/khobra-cleaning/bookings', {
    method: 'POST',
    body: JSON.stringify({ ...input, bookingType: 'one_time', employeeCount: 1 }),
  }, token),
  updateStatus: (id, status, token) => request<Booking>('/api/khobra-cleaning/bookings', {
    method: 'PUT',
    body: JSON.stringify({ id, status }),
  }, token),
  completeBooking: (bookingId, token) => request('/api/khobra-cleaning/bookings/cleaner-complete', {
    method: 'POST',
    body: JSON.stringify({ bookingId }),
  }, token),
  submitCompletionTiming: (bookingId, withinScheduledTime, token) => request<CompletionTimingResponse>('/api/khobra-cleaning/bookings/completion-timing', {
    method: 'POST',
    body: JSON.stringify({ bookingId, withinScheduledTime }),
  }, token),
  getPickupAlerts: (token) => request<PickupAlert[]>('/api/khobra-cleaning/bookings/pickup-alerts', {}, token),
  markPickupAlertViewed: (id, token) => request<PickupAlert>('/api/khobra-cleaning/bookings/pickup-alerts', {
    method: 'PUT', body: JSON.stringify({ id }),
  }, token),
  selectPaymentMethod: (bookingId, method, token) => request('/api/khobra-cleaning/bookings/payment-method', {
    method: 'POST', body: JSON.stringify({ bookingId, method }),
  }, token),
  receiveCash: (bookingId, token) => request('/api/khobra-cleaning/bookings/cleaner-cash', {
    method: 'POST', body: JSON.stringify({ bookingId }),
  }, token),
  submitRating: (bookingId, overallRating, overallComment, ratings, token) => request<Booking>('/api/khobra-cleaning/bookings/rate', {
    method: 'POST', body: JSON.stringify({ bookingId, overallRating, overallComment, ratings }),
  }, token),
}

const operationPaths: Record<OperationModule, string> = {
  services: '/api/khobra-cleaning/services',
  customers: '/api/khobra-cleaning/customers',
  employees: '/api/khobra-cleaning/employees',
  attendance: '/api/khobra-cleaning/attendance',
  invoices: '/api/khobra-cleaning/invoices',
  inventory: '/api/khobra-cleaning/inventory',
  complaints: '/api/khobra-cleaning/complaints',
  notifications: '/api/khobra-cleaning/notifications',
}

export const khobraOperationsGateway: OperationsGateway = {
  getRecords: (module, token) => request<OperationRecord[]>(operationPaths[module], {}, token),
}
