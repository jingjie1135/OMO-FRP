const REDACTED = "[REDACTED]"

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bAuthorization\s*:\s*Bearer\s+[^\s,;]+/gi,
  /\b(Bearer)\s+[^\s,;]+/gi,
  /\b(password|token|secret)\s*[=:]\s*[^\s,;]+/gi,
]

export function redactSensitiveText(input: string): string {
  return SENSITIVE_PATTERNS.reduce((text, pattern) => text.replace(pattern, (match, key: string | undefined) => {
    if (typeof key === "string" && key.length > 0) {
      return `${key}=${REDACTED}`
    }
    return REDACTED
  }), input)
}
