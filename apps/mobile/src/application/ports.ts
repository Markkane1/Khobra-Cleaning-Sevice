import type { Session, SignupInput } from '../domain/auth/types'
import type { DashboardStats } from '../domain/dashboard/types'
import type { BankTransferInput, Booking, CleanerRatingInput, CompanyBankAccount, CompletionTimingResponse, CreateBookingInput, DriverTrip, PickupAlert } from '../domain/bookings/types'
import type { OperationModule, OperationRecord } from '../domain/operations/types'
import type { CreateDriverExpenseInput, DriverExpense } from '../domain/expenses/types'

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
  completeBooking(bookingId: string, token: string): Promise<{ booking: Booking; completedAt: string; completedBy: string }>
  submitCompletionTiming(bookingId: string, withinScheduledTime: boolean, token: string): Promise<CompletionTimingResponse>
  getPickupAlerts(token: string): Promise<PickupAlert[]>
  getTrips(token: string): Promise<DriverTrip[]>
  markPickupAlertViewed(id: string, token: string): Promise<PickupAlert>
  selectPaymentMethod(bookingId: string, method: 'cash' | 'bank_transfer', token: string): Promise<unknown>
  getCompanyBankAccounts(token: string): Promise<CompanyBankAccount[]>
  uploadPaymentProof(file: { uri: string; name: string; mimeType: string }, token: string): Promise<string>
  submitBankTransfer(input: BankTransferInput, token: string): Promise<unknown>
  receiveCash(bookingId: string, token: string): Promise<{ amountReceived: number; receivedAt: string }>
  reportCustomerIssue(bookingId: string, description: string, token: string): Promise<unknown>
  submitRating(bookingId: string, overallRating: number, overallComment: string, ratings: CleanerRatingInput[], token: string): Promise<Booking>
}

export interface OperationsGateway {
  getRecords(module: OperationModule, token: string): Promise<OperationRecord[]>
}

export interface DriverExpenseGateway {
  getExpenses(token: string): Promise<DriverExpense[]>
  createExpense(input: CreateDriverExpenseInput, token: string): Promise<DriverExpense>
}

export interface SessionStore {
  read(): Promise<Session | null>
  write(session: Session): Promise<void>
  clear(): Promise<void>
}
