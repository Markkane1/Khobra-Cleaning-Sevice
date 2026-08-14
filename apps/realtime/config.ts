export function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be configured`)
  return value
}
