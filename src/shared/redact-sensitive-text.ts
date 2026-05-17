const REDACTED = "[REDACTED]"

export function redactSensitiveText(input: string): string {
  return input
    .replace(/\bAuthorization\s*:\s*([^\s,;]+)\s+[^\s,;]+/gi, (_match, scheme: string) => `Authorization: ${scheme} ${REDACTED}`)
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(/(--token\s+)([^\s,;]+)/gi, `$1${REDACTED}`)
    .replace(/(["'](?:password|token|secret|authorization|authToken|auth_token)["']\s*:\s*["'])([^"']+)(["'])/gi, `$1${REDACTED}$3`)
    .replace(/\b(OPENCODE_SERVER_PASSWORD|FRP_TOKEN)\s*[=:]\s*[^\s,;]+/gi, `$1=${REDACTED}`)
    .replace(/\b(password|token|secret|authToken|auth_token)\s*[=:]\s*[^\s,;&]+/gi, `$1=${REDACTED}`)
    .replace(/([?&](?:password|token|secret|authorization|authToken|auth_token)=)([^&#\s]+)/gi, `$1${REDACTED}`)
}
