import type { AuthGateway, SessionStore } from './ports'
import type { Session, SignupInput } from '../domain/auth/types'

export async function signIn(
  gateway: AuthGateway,
  sessionStore: SessionStore,
  email: string,
  password: string,
  turnstileToken: string,
): Promise<Session> {
  if (!email.trim()) throw new Error('Email is required.')
  if (!password) throw new Error('Password is required.')
  if (!turnstileToken) throw new Error('Complete the security check.')

  const session = await gateway.signIn(email.trim(), password, turnstileToken)
  await sessionStore.write(session)
  return session
}

export async function signUp(
  gateway: AuthGateway,
  sessionStore: SessionStore,
  input: SignupInput,
): Promise<Session> {
  if (!input.name.trim() || !input.email.trim() || !input.phone.trim() || input.password.length < 8) {
    throw new Error('Name, email, phone, and an 8-character password are required.')
  }
  if (!input.turnstileToken) throw new Error('Complete the security check.')

  const session = await gateway.signUp({
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
  })
  await sessionStore.write(session)
  return session
}
