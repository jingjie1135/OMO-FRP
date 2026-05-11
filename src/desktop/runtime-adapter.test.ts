import { describe, expect, it } from "bun:test"
import { getDesktopRuntimeInfo } from "./runtime-adapter"

describe("desktop runtime adapter", () => {
  it("returns desktop capabilities", async () => {
    const info = await getDesktopRuntimeInfo()

    expect(info.capabilities.mode).toBe("desktop")
    expect(info.capabilities.canManageFrpClient).toBe(true)
    expect(info.capabilities.canManageFrpServer).toBe(false)
  })
})
