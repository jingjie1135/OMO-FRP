import { describe, expect, it } from "bun:test"
import { ActionRunner } from "./action-runner"

describe("ActionRunner", () => {
  it("initializes with idle state", () => {
    const runner = new ActionRunner()
    expect(runner.getState("res1")).toBe("idle")
  })

  it("transitions to pending when action starts", async () => {
    const runner = new ActionRunner()
    const promise = runner.run("res1", () => new Promise(resolve => setTimeout(() => resolve("ok"), 10)))
    expect(runner.getState("res1")).toBe("pending")
    await promise
    expect(runner.getState("res1")).toBe("succeeded")
  })

  it("transitions to failed when action fails", async () => {
    const runner = new ActionRunner()
    const promise = runner.run("res1", () => Promise.reject(new Error("fail")))
    try {
      await promise
    } catch (e) {
    }
    expect(runner.getState("res1")).toBe("failed")
    const error = runner.getError("res1")
    expect(error?.message).toBe("fail")
  })

  it("guards against duplicate operations for same resource", async () => {
    const runner = new ActionRunner()
    let callCount = 0
    const operation = async () => {
      callCount++
      await new Promise(resolve => setTimeout(resolve, 20))
      return "done"
    }

    const p1 = runner.run("res1", operation)
    const p2 = runner.run("res1", operation)

    await Promise.all([p1, p2])
    expect(callCount).toBe(1)
  })

  it("normalizes errors with target and status code", async () => {
    const runner = new ActionRunner()
    const error = Object.assign(new Error("Not Found"), { status: 404, target: "api/tools" })
    
    await runner.run("res1", () => Promise.reject(error)).catch(() => {})
    
    const normalized = runner.getError("res1")
    expect(normalized?.status).toBe(404)
    expect(normalized?.target).toBe("api/tools")
  })

  it("detects reauth need for 401/403", async () => {
    const runner = new ActionRunner()
    const error = Object.assign(new Error("Unauthorized"), { status: 401 })
    
    await runner.run("res1", () => Promise.reject(error)).catch(() => {})
    
    const normalized = runner.getError("res1")
    expect(normalized?.needsReauth).toBe(true)
  })

  it("refresh helper preserves previous data on failure", async () => {
    const runner = new ActionRunner()
    let data = { value: 1 }
    
    await runner.run("res1", async () => {
        return data
    })
    expect(runner.getData<{ value: number }>("res1")).toEqual({ value: 1 })

    await runner.run("res1", () => Promise.reject(new Error("network error")), { isRefresh: true }).catch(() => {})
    
    expect(runner.getState("res1")).toBe("failed")
    expect(runner.getData<{ value: number }>("res1")).toEqual({ value: 1 })
  })

  it("refresh helper preserves caller-provided unsaved draft state on failure", async () => {
    const runner = new ActionRunner()
    const serverData = { id: 1, name: "original" }
    const draftState = { name: "edited" }

    await runner.run("res1", async () => serverData)

    await runner.run("res1", () => Promise.reject(new Error("network error")), { 
      isRefresh: true,
      draftState 
    }).catch(() => {})

    expect(runner.getData<{ id: number, name: string }>("res1")).toEqual(serverData)
    expect(runner.getDraft<{ name: string }>("res1")).toEqual(draftState)
  })

  it("recovers from network failure after retry and updates data while keeping draft", async () => {
    const runner = new ActionRunner()
    let attempt = 0
    const serverData = { id: 1, name: "original" }
    const updatedData = { id: 1, name: "updated" }
    const draftState = { name: "edited" }

    const operation = async () => {
      attempt++
      if (attempt === 1) throw new Error("network failure")
      return updatedData
    }

    await runner.run("res1", operation, { draftState }).catch(() => {})
    expect(runner.getState("res1")).toBe("failed")
    expect(runner.getDraft<{ name: string }>("res1")).toEqual(draftState)

    await runner.run("res1", operation, { draftState })
    expect(runner.getState("res1")).toBe("succeeded")
    expect(runner.getData<{ id: number, name: string }>("res1")).toEqual(updatedData)
    expect(runner.getDraft<{ name: string }>("res1")).toEqual(draftState)
  })

  it("handles synchronous throws in action callbacks", async () => {
    const runner = new ActionRunner()
    const operation = () => {
      throw new Error("sync failure")
    }

    await runner.run("res1", operation).catch(() => {})

    expect(runner.getState("res1")).toBe("failed")
    expect(runner.getError("res1")?.message).toBe("sync failure")

    await runner.run("res1", async () => "recovered")
    expect(runner.getState("res1")).toBe("succeeded")
    expect(runner.getData<string>("res1")).toBe("recovered")
  })

  it("normalizes malformed error objects safely with type guards", async () => {
    const runner = new ActionRunner()
    const malformed = {
      message: 123,
      target: { not: "a string" },
      status: "500"
    }

    await runner.run("res1", () => Promise.reject(malformed)).catch(() => {})

    const normalized = runner.getError("res1")
    expect(normalized?.message).toBe("Unknown error")
    expect(normalized?.target).toBeUndefined()
    expect(normalized?.status).toBeUndefined()
  })
})
