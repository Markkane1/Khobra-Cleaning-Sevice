export type Role = 'admin' | 'customer' | 'cleaner' | 'driver'

export interface Session {
  token: string
  expiresAt: number
  user: {
    userId: string
    tenantId: string
    email: string
    name: string
    role: Role
  }
}

export interface SignupInput {
  name: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  privacyPolicyAccepted: boolean
  turnstileToken: string
}
