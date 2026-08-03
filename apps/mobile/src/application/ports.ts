import type { Session, SignupInput } from '../domain/auth/types'
import type { DashboardStats } from '../domain/dashboard/types'
import type { Booking, CompletionTimingResponse, CreateBookingInput, PickupAlert } from '../domain/bookings/types'
import type { OperationModule, OperationRecord } from '../domain/operations/types'

export interface AuthGateway {
  signIn(email: string, password: string, turnstileToken: string): Promise<Session>
  signUp(input: SignupInput): Promise<Session>
}

export interface DashboardGateway {
  getStats(token: string): Promise<DashboardStats>
}

export interface BookingGateway {
  getBookings(token: string): Promise<Booking[]>
  createBooking(input: CreateBookingInput, token: string): Promise<Booking>
  updateStatus(id: string, status: string, token: string): Promise<Booking>
  submitCompletionTiming(bookingId: string, withinScheduledTime: boolean, token: string): Promise<CompletionTimingResponse>
  getPickupAlerts(token: string): Promise<PickupAlert[]>
  markPickupAlertViewed(id: string, token: string): Promise<PickupAlert>
}

export interface OperationsGateway {
  getRecords(module: OperationModule, token: string): Promise<OperationRecord[]>
}

export interface SessionStore {
  read(): Promise<Session | null>
  write(session: Session): Promise<void>
  clear(): Promise<void>
}
