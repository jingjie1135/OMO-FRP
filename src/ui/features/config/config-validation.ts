/**
 * Validates configuration content before saving.
 * Returns an error message if invalid, or null if valid.
 */
export function validateConfigContent(content: string, format: string): string | null {
  if (!content || !content.trim()) {
    return "Content cannot be empty"
  }

  if (format === "json") {
    try {
      JSON.parse(content)
    } catch (e) {
      return `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  // Reject obvious log fragments with secret-like patterns
  // Pattern 1: Date/time followed by log level and secret
  const logPattern = /\d{4}-\d{2}-\d{2}.*(?:INFO|DEBUG|WARN|ERROR|TRACE).*=(?:[a-z0-9_-]{3,})/i
  if (logPattern.test(content)) {
    return "Content appears to contain unredacted log fragments with secrets"
  }

  // Pattern 2: Authorization headers in JSON-like structures (common in logs)
  const authHeaderPattern = /"authorization"\s*:\s*"Bearer\s+[a-z0-9_-]{3,}"/i
  if (authHeaderPattern.test(content)) {
    return "Content appears to contain unredacted log fragments with secrets"
  }

  return null
}
