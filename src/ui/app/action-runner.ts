export type ActionStatus = "idle" | "pending" | "succeeded" | "failed"
export type JobStatus = "queued" | "running" | "succeeded" | "failed"

export interface ActionError {
  message: string
  target?: string
  status?: number
  needsReauth?: boolean
  retryable?: boolean
}

export interface ActionRunnerOptions {
  isRefresh?: boolean
  draftState?: unknown
}

export class ActionRunner {
  private states = new Map<string, ActionStatus>()
  private errors = new Map<string, ActionError>()
  private data = new Map<string, unknown>()
  private drafts = new Map<string, unknown>()
  private promises = new Map<string, Promise<unknown>>()
  private listeners = new Set<() => void>()

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(key: string): ActionStatus {
    return this.states.get(key) || "idle"
  }

  getError(key: string): ActionError | undefined {
    return this.errors.get(key)
  }

  getData<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined
  }

  getDraft<T = unknown>(key: string): T | undefined {
    return this.drafts.get(key) as T | undefined
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }

  async run<T>(key: string, action: () => Promise<T> | T, options: ActionRunnerOptions = {}): Promise<T> {
    const existingPromise = this.promises.get(key)
    if (existingPromise) {
      return existingPromise as Promise<T>
    }

    const previousData = this.data.get(key)
    if (options.draftState !== undefined) {
      this.drafts.set(key, options.draftState)
      this.notify()
    }

    this.states.set(key, "pending")
    this.errors.delete(key)
    this.notify()

    const promise = Promise.resolve()
      .then(() => action())
      .then((result) => {
        this.states.set(key, "succeeded")
        this.data.set(key, result)
        this.promises.delete(key)
        this.notify()
        return result
      })
      .catch((error: unknown) => {
        this.states.set(key, "failed")
        if (options.isRefresh && previousData !== undefined) {
          this.data.set(key, previousData)
        }
        const normalized = this.normalizeError(error)
        this.errors.set(key, normalized)
        this.promises.delete(key)
        this.notify()
        throw error
      })

    this.promises.set(key, promise)
    return promise
  }

  private normalizeError(error: unknown): ActionError {
    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>
      const message = typeof err.message === "string" ? err.message : "Unknown error"
      const target = typeof err.target === "string" ? err.target : undefined
      const statusValue = err.status ?? err.statusCode
      const status = typeof statusValue === "number" ? statusValue : undefined
      
      return {
        message,
        target,
        status,
        needsReauth: status === 401 || status === 403,
        retryable: status !== 400 && status !== 401 && status !== 403 && status !== 404,
      }
    }

    return {
      message: typeof error === "string" ? error : "Unknown error",
      retryable: true,
    }
  }
}
