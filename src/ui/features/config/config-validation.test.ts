import { describe, expect, it } from "bun:test"
import { validateConfigContent } from "./config-validation"

describe("validateConfigContent", () => {
  it("rejects empty content", () => {
    expect(validateConfigContent("", "json")).toBe("Content cannot be empty")
    expect(validateConfigContent("   ", "json")).toBe("Content cannot be empty")
  })

  it("validates JSON format when requested", () => {
    expect(validateConfigContent('{"key": "value"}', "json")).toBeNull()
    expect(validateConfigContent('invalid json', "json")).toContain("Invalid JSON")
  })

  it("allows non-JSON content when format is not JSON", () => {
    expect(validateConfigContent("some text", "text")).toBeNull()
  })

  it("rejects content that looks like log fragments with secrets", () => {
    const logWithSecret = '2023-01-01 INFO: Starting with token=secret123'
    const error = validateConfigContent(logWithSecret, "text")
    expect(error).not.toBeNull()
    expect(error!).toContain("log fragment")
    
    const plainConfig = 'token=secret123'
    expect(validateConfigContent(plainConfig, "text")).toBeNull()
  })

  it("rejects unredacted authorization headers in logs", () => {
    const logWithAuth = '{"authorization": "Bearer sk-12345"}'
    // This is valid JSON but we should reject it because it's a secret
    const error = validateConfigContent(logWithAuth, "json")
    expect(error).not.toBeNull()
    expect(error!).toContain("log fragment")
  })
})
