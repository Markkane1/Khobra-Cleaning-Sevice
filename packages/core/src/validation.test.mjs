import assert from 'node:assert/strict'
import test from 'node:test'
import { ChangePasswordSchema, LoginSchema, SignupSchema, UpdateOwnProfileSchema } from './auth/schema.ts'
import { CreateBookingSchema, PublicBookingSchema, UpdateBookingSchema } from './bookings/schema.ts'
import { CreateBusinessExpenseSchema, CreateDriverExpenseSchema } from './driver-expenses/schema.ts'
import { CreateEmployeeSchema } from './employees/schema.ts'
import { CreateLeaveSchema, UpdateLeaveSchema } from './leave/schema.ts'
import { CompanyBankAccountSchema } from './payments/schema.ts'
import { UpdateSettingsSchema } from './settings/schema.ts'

const tomorrow = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

test('authentication schemas reject malformed and mismatched credentials', () => {
  assert.equal(LoginSchema.safeParse({ email: 'bad', password: '', turnstileToken: '' }).success, false)
  assert.equal(SignupSchema.safeParse({ name: 'A', email: 'bad', phone: '1', password: 'password1', confirmPassword: 'password2', turnstileToken: 'ok' }).success, false)
  assert.equal(ChangePasswordSchema.safeParse({ currentPassword: 'same-password', newPassword: 'same-password' }).success, false)
  assert.equal(UpdateOwnProfileSchema.safeParse({ name: '', email: 'bad', phone: '1' }).success, false)
})

test('booking schemas validate public input and discard client-controlled actor fields', () => {
  const date = tomorrow()
  const booking = CreateBookingSchema.parse({
    customerId: 'customer-1', serviceIds: ['service-1'], scheduledDate: date, startDate: date, endDate: date,
    startTime: '09:00', endTime: '11:00', bookingType: 'one_time', createdBy: 'forged-user',
  })
  const update = UpdateBookingSchema.parse({ id: 'booking-1', cancelledBy: 'forged-user' })

  assert.equal('createdBy' in booking, false)
  assert.equal('cancelledBy' in update, false)
  assert.equal(PublicBookingSchema.safeParse({ serviceId: '', name: '', email: 'bad', phone: '', scheduledDate: date, startTime: '09:00', duration: 2, employeeCount: 1, address: '', city: '', preferredPaymentMethod: 'cash' }).success, false)
})

test('operational schemas reject invalid money, dates, configuration, and account details', () => {
  assert.equal(CreateDriverExpenseSchema.safeParse({ category: 'petrol', amount: -1, expenseDate: tomorrow() }).success, false)
  assert.equal(CreateBusinessExpenseSchema.safeParse({ category: 'other', description: '', amount: 0, expenseDate: tomorrow() }).success, false)
  assert.equal(CreateEmployeeSchema.safeParse({ email: 'employee@example.com', name: '', baseSalary: -1, temporaryPassword: 'password1' }).success, false)
  assert.equal(CreateLeaveSchema.safeParse({ employeeId: 'employee-1', startDate: '2026-08-12', endDate: '2026-08-11', days: 1 }).success, false)
  assert.equal(UpdateSettingsSchema.safeParse({ taxRate: 2, firstBookingTime: '20:00', lastWorkingTime: '08:00' }).success, false)
  assert.equal(CompanyBankAccountSchema.safeParse({ accountTitle: '', bankName: '', accountNumber: '1', currency: 'XX' }).success, false)
})

test('leave approval actor cannot be supplied by the client', () => {
  const update = UpdateLeaveSchema.parse({ id: 'leave-1', status: 'approved', approvedBy: 'forged-user' })
  assert.equal('approvedBy' in update, false)
})
