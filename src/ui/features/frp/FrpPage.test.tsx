import { describe, expect, it } from "bun:test"
import { selectFrpPanelKind } from "./FrpPage"

describe("FrpPage", () => {
  it("uses server panel for server runtime", () => {
    expect(selectFrpPanelKind({ mode: "server", canManageFrpServer: true, canManageFrpClient: false })).toBe("server")
  })

  it("uses client panel for desktop runtime", () => {
    expect(selectFrpPanelKind({ mode: "desktop", canManageFrpServer: false, canManageFrpClient: true })).toBe("client")
  })
})
