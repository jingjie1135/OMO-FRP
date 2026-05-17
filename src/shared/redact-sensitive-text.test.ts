import { describe, expect, it } from "bun:test"
import { redactSensitiveText } from "./redact-sensitive-text"

describe("redactSensitiveText", () => {
  it("redacts environment variables, authorization schemes, and camel/snake case secret keys", () => {
    const redacted = redactSensitiveText([
      "OPENCODE_SERVER_PASSWORD=super-password",
      "FRP_TOKEN=super-frp-token",
      "Authorization: Basic dXNlcjpwYXNz",
      "Authorization: Token ghp_secret",
      "authToken=camel-secret",
      "auth_token=snake-secret",
      '{"authToken":"json-camel","auth_token":"json-snake"}',
    ].join("\n"))

    expect(redacted).not.toContain("super-password")
    expect(redacted).not.toContain("super-frp-token")
    expect(redacted).not.toContain("dXNlcjpwYXNz")
    expect(redacted).not.toContain("ghp_secret")
    expect(redacted).not.toContain("camel-secret")
    expect(redacted).not.toContain("snake-secret")
    expect(redacted).not.toContain("json-camel")
    expect(redacted).not.toContain("json-snake")
    expect(redacted).toContain("OPENCODE_SERVER_PASSWORD=[REDACTED]")
    expect(redacted).toContain("FRP_TOKEN=[REDACTED]")
    expect(redacted).toContain("Authorization: Basic [REDACTED]")
    expect(redacted).toContain("Authorization: Token [REDACTED]")
    expect(redacted).toContain("authToken=[REDACTED]")
    expect(redacted).toContain("auth_token=[REDACTED]")
    expect(redacted).toContain('"authToken":"[REDACTED]"')
    expect(redacted).toContain('"auth_token":"[REDACTED]"')
  })
})
