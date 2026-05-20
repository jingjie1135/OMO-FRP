import { describe, expect, it, mock } from "bun:test"
import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { ErrorState } from "./ErrorState"

describe("ErrorState", () => {
  it("renders error message and target", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    
    await act(async () => {
      root.render(
        React.createElement(ErrorState, {
          error: { message: "Failed to fetch", target: "api/tools", status: 500 }
        })
      )
    })
    
    expect(container.textContent).toContain("Failed to fetch")
    expect(container.textContent).toContain("api/tools")
    expect(container.textContent).toContain("500")
  })

  it("renders retry button when retryable", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    const onRetry = mock(() => {})
    
    await act(async () => {
      root.render(
        React.createElement(ErrorState, {
          error: { message: "Fail", retryable: true },
          onRetry
        })
      )
    })
    
    const button = container.querySelector("button")
    expect(button?.textContent).toBe("重试")
    
    await act(async () => {
      button?.click()
    })
    
    expect(onRetry).toHaveBeenCalled()
  })

  it("renders reauth hint for 401/403", async () => {
    const container = document.createElement("div")
    const root = createRoot(container)
    
    await act(async () => {
      root.render(
        React.createElement(ErrorState, {
          error: { message: "Forbidden", status: 403, needsReauth: true }
        })
      )
    })
    
    expect(container.textContent).toContain("请重新登录")
  })
})
