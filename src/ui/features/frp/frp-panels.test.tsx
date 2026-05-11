import { describe, expect, it } from "bun:test"
import { getFrpPanelActions } from "./frp-panel-actions"

describe("frp panel actions", () => {
  it("shows server actions in server mode", () => {
    expect(getFrpPanelActions("server")).toContain("初始化 frp-panel")
    expect(getFrpPanelActions("server")).toContain("生成桌面端连接配置")
  })

  it("shows client actions in desktop mode", () => {
    expect(getFrpPanelActions("desktop")).toContain("生成 frpc 配置")
    expect(getFrpPanelActions("desktop")).toContain("启动 frpc")
  })
})
