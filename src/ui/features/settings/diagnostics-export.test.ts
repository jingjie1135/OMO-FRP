import { describe, expect, it } from "bun:test"
import { redactDiagnostics } from "./diagnostics-export"
import type { Diagnostics } from "../../../management-api/types"

describe("diagnostics export redaction", () => {
  it("redacts secrets from diagnostics logs and metadata", () => {
    const raw: Diagnostics = {
      runtime: { 
        capabilities: { 
          mode: "server",
          canManageFrpServer: true,
          canManageFrpClient: false,
          canInstallServerServices: true,
          canAccessLocalFilesystem: true,
          canManageSystemd: true,
          canManageLocalProcesses: true,
          canManageCloudflareTunnel: true,
        }, 
        config: { mode: "server", toolInstances: [], pluginConfigs: [], publicEndpoints: [], frpClients: [] } 
      },
      tools: [],
      endpoints: [],
      frp: { mode: "server", running: true, message: "token=SECRET_TOKEN" },
      jobs: [],
      redactedLogs: [
        { timestamp: "2026-05-17T10:00:00Z", level: "info", message: "Starting with password=MY_PASSWORD" },
        { timestamp: "2026-05-17T10:00:01Z", level: "info", message: "Authorization: Bearer MY_TOKEN" },
        { timestamp: "2026-05-17T10:00:02Z", level: "info", message: "cloudflared tunnel run --token CLOUDFLARE_TOKEN" },
        { timestamp: "2026-05-17T10:00:03Z", level: "info", message: "callback https://example.com/callback?token=QUERY_TOKEN&safe=1" },
        { timestamp: "2026-05-17T10:00:04Z", level: "info", message: '{"token":"JSON_TOKEN","authorization":"Basic JSON_BASIC"}' },
      ],
    }

    const redacted = redactDiagnostics(raw)

    expect(redacted.frp.message).not.toContain("SECRET_TOKEN")
    expect(redacted.frp.message).toContain("[REDACTED]")
    expect(redacted.redactedLogs[0].message).not.toContain("MY_PASSWORD")
    expect(redacted.redactedLogs[0].message).toContain("[REDACTED]")
    expect(redacted.redactedLogs[1].message).not.toContain("MY_TOKEN")
    expect(redacted.redactedLogs[1].message).toContain("[REDACTED]")
    expect(redacted.redactedLogs[2].message).not.toContain("CLOUDFLARE_TOKEN")
    expect(redacted.redactedLogs[2].message).toContain("--token [REDACTED]")
    expect(redacted.redactedLogs[3].message).not.toContain("QUERY_TOKEN")
    expect(redacted.redactedLogs[3].message).toContain("?token=[REDACTED]&safe=1")
    expect(redacted.redactedLogs[3].message).not.toContain("?token==")
    expect(redacted.redactedLogs[4].message).not.toContain("JSON_TOKEN")
    expect(redacted.redactedLogs[4].message).not.toContain("JSON_BASIC")
    expect(redacted.redactedLogs[4].message).toContain('"token":"[REDACTED]"')
    expect(redacted.redactedLogs[4].message).toContain('"authorization":"[REDACTED]"')
  })
})
