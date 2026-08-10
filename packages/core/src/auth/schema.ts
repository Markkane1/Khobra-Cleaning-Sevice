import { z } from 'zod'

export const UserRoleSchema = z.enum(['admin', 'driver', 'customer', 'cleaner'])

export const AssignRoleSchema = z.object({
  userId: z.string().min(1, 'User is required'),
  role: UserRoleSchema,
}).strict()

export const ResetUserPasswordSchema = z.object({
  userId: z.string().min(1, 'User is required'),
}).strict()

export const LoginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').transform(value => value.toLowerCase()),
  password: z.string().min(1, 'Password is required').max(128),
  turnstileToken: z.string().min(1, 'Please complete the security check'),
}).strict()

export const SignupSchema = z.object({
  name: z.string().trim().min(2, 'Name must contain at least 2 characters').max(120),
  email: z.string().trim().email('Enter a valid email address').transform(value => value.toLowerCase()),
  phone: z.string().trim().min(5, 'Enter a valid phone number').max(30),
  password: z.string().min(8, 'Password must contain at least 8 characters').max(128),
  confirmPassword: z.string().min(1, 'Confirm your password'),
  privacyPolicyAccepted: z.literal(true, { message: 'Accept the Privacy Policy to create an account' }),
  turnstileToken: z.string().min(1, 'Please complete the security check'),
}).strict().refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: z.string().min(8, 'New password must contain at least 8 characters').max(128),
}).strict().refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from the current password',
  path: ['newPassword'],
})

export const UpdateOwnProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must contain at least 2 characters').max(120).optional(),
  email: z.string().trim().email('Enter a valid email address').transform(value => value.toLowerCase()).optional(),
  phone: z.string().trim().min(5, 'Enter a valid phone number').max(30).optional(),
  avatarUrl: z.string().url('Profile photo URL is invalid').optional(),
}).strict().refine(data => Object.values(data).some(value => value !== undefined), {
  message: 'Provide at least one profile field to update',
})

export type LoginDTO = z.infer<typeof LoginSchema>
export type SignupDTO = z.infer<typeof SignupSchema>
export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>
export type UpdateOwnProfileDTO = z.infer<typeof UpdateOwnProfileSchema>
