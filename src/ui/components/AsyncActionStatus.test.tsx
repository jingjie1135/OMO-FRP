import { describe, expect, it } from "bun:test"
import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { AsyncActionStatus } from "./AsyncActionStatus"

describe("AsyncActionStatus", () => {
  it("renders pending state", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    
    await act(async () => {
      root.render(
        React.createElement(AsyncActionStatus, {
          status: "pending"
        })
      )
    })
    
    expect(container.textContent).toContain("处理中...")
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })

  it("renders success state", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    
    await act(async () => {
      root.render(
        React.createElement(AsyncActionStatus, {
          status: "succeeded"
        })
      )
    })
    
    expect(container.textContent).toContain("已完成")
  })

  it("renders job state when provided", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    
    await act(async () => {
      root.render(
        React.createElement(AsyncActionStatus, {
          status: "pending",
          jobStatus: "running"
        })
      )
    })
    
    expect(container.textContent).toContain("任务执行中...")
  })

  it("renders nothing for idle state", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    
    await act(async () => {
      root.render(
        React.createElement(AsyncActionStatus, {
          status: "idle"
        })
      )
    })
    
    expect(container.textContent).toBe("")
  })
})
