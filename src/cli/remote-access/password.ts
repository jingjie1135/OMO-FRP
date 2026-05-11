const MIN_PASSWORD_LENGTH = 16

const WEAK_PASSWORDS = new Set([
  "password",
  "password123",
  "opencode",
  "openagent",
  "1234567890123456",
])

export function assertStrongPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`)
  }

  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    throw new Error("Password is too easy to guess")
  }

  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  if ([hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length < 3) {
    throw new Error("Password must include at least three of: lowercase, uppercase, number, symbol")
  }
}
