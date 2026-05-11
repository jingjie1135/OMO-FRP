const SECRET_PATTERNS = [
  /(OPENCODE_SERVER_PASSWORD=)([^\s]+)/g,
  /(FRP_TOKEN=)([^\s]+)/g,
  /(auth\.token\s*=\s*")([^"]+)(")/g,
  /(tokenRef\s*[:=]\s*)([^\s,}]+)/g,
]

export function redactLog(input: string): string {
  let output = input
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (_match, prefix: string, _secret: string, suffix = "") => `${prefix}<redacted>${suffix}`)
  }
  return output
}

export function redactRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (/password|token|secret/i.test(key) && value !== undefined) return [key, "<redacted>"]
      return [key, value]
    }),
  ) as T
}
