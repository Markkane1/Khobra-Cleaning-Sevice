import assert from 'node:assert/strict'
import test from 'node:test'
import { ChangePasswordSchema, LoginSchema, SignupSchema, UpdateOwnProfileSchema } from './auth/schema.ts'
import { AssignEmployeesSchema, CreateBookingSchema, PublicBookingSchema, UpdateBookingSchema, calculateMultiServicePricing } from './bookings/schema.ts'
import { CreateBusinessExpenseSchema, CreateDriverExpenseSchema } from './driver-expenses/schema.ts'
import { CreateEmployeeSchema } from './employees/schema.ts'
import { CreateLeaveSchema, UpdateLeaveSchema } from './leave/schema.ts'
import { getDirectionsUrl } from './location.ts'
import { CompanyBankAccountSchema } from './payments/schema.ts'
import { UpdateSettingsSchema } from './settings/schema.ts'

const tomorrow = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

test('directions links target native map apps and preserve the booking pin', () => {
  assert.equal(getDirectionsUrl('ios', 25.2048, 55.2708), 'maps://?daddr=25.2048,55.2708&dirflg=d')
  assert.match(getDirectionsUrl('android', 25.2048, 55.2708, 'KH-001'), /^geo:25\.2048,55\.2708\?q=/)
  assert.equal(getDirectionsUrl('web', 25.2048, 55.2708), 'https://www.google.com/maps/dir/?api=1&destination=25.2048%2C55.2708')
})

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
  assert.equal(PublicBookingSchema.safeParse({ serviceId: '', withMaterials: false, name: '', email: 'bad', phone: '', scheduledDate: date, startTime: '09:00', duration: 2, employeeCount: 1, address: '', city: '', preferredPaymentMethod: 'cash' }).success, false)
  assert.equal(PublicBookingSchema.safeParse({ serviceId: 'service-1', withMaterials: true, name: 'Ali', email: 'ali@example.com', phone: '+971500000000', scheduledDate: date, startTime: '09:00', duration: 2, employeeCount: 1, address: '', city: 'Dubai', latitude: 25.2048, longitude: 55.2708, preferredPaymentMethod: 'cash' }).success, true)
  assert.equal(PublicBookingSchema.safeParse({ serviceId: 'service-1', withMaterials: false, name: 'Ali', email: 'ali@example.com', phone: '+971500000000', scheduledDate: date, startTime: '09:00', duration: 2, employeeCount: 1, address: '', city: 'Dubai', latitude: 25.2048, preferredPaymentMethod: 'cash' }).success, false)
  assert.equal(AssignEmployeesSchema.safeParse({ bookingId: 'booking-1', employeeIds: ['cleaner-1'] }).success, false)
  assert.equal(AssignEmployeesSchema.safeParse({ bookingId: 'booking-1', driverId: 'driver-1', employeeIds: ['cleaner-1'] }).success, true)
})

test('service variant rate is preserved in authoritative pricing', () => {
  const pricing = calculateMultiServicePricing([{ id: 'service-1', name: 'Deep Cleaning', baseRate: 180, includesMaterials: true }], 2, 3)
  assert.equal(pricing.netAmount, 1080)
  assert.equal(pricing.items[0].includesMaterials, true)
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
