import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"

describe("management UI docs", () => {
  it("documents shared UI and dual runtime", () => {
    const doc = readFileSync("docs/guide/management-ui.md", "utf8")
    expect(doc).toContain("同一套 React 管理界面")
    expect(doc).toContain("服务器 Web")
    expect(doc).toContain("Tauri 桌面端")
    expect(doc).toContain("FRP 服务端")
    expect(doc).toContain("FRP 客户端")
  })
})
