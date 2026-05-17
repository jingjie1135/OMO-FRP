const REDACTED = "[REDACTED]"

export function redactSensitiveText(input: string): string {
  return input
    .replace(/\bAuthorization\s*:\s*Bearer\s+[^\s,;]+/gi, `Authorization: Bearer ${REDACTED}`)
    .replace(/\bAuthorization\s*:\s*Basic\s+[^\s,;]+/gi, `Authorization: Basic ${REDACTED}`)
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(/(--token\s+)([^\s,;]+)/gi, `$1${REDACTED}`)
    .replace(/(["'](?:password|token|secret|authorization)["']\s*:\s*["'])([^"']+)(["'])/gi, `$1${REDACTED}$3`)
    .replace(/\b(OPENCODE_SERVER_PASSWORD|FRP_TOKEN)\s*[=:]\s*[^\s,;]+/gi, `$1=${REDACTED}`)
    .replace(/\b(password|token|secret|authorization)\s*[=:]\s*[^\s,;&]+/gi, `$1=${REDACTED}`)
    .replace(/([?&](?:password|token|secret|authorization)=)([^&#\s]+)/gi, `$1${REDACTED}`)
}
