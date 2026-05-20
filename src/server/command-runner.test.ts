import { expect, test } from "bun:test"
import { runCommand } from "./command-runner"

test("runs a command with args and captures output", async () => {
  const result = await runCommand({
    ...createEchoCommand("hello"),
    timeoutMs: 5_000,
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout.trim()).toBe("hello")
  expect(result.stderr).toBe("")
})

test("redacts sensitive command output", async () => {
  const result = await runCommand({
    ...createEchoCommand("token=secret-token password=hunter2"),
    timeoutMs: 5_000,
  })

  expect(result.stdout).not.toContain("secret-token")
  expect(result.stdout).not.toContain("hunter2")
  expect(result.stdout).toContain("[REDACTED]")
})

test("does not inherit arbitrary parent environment variables", async () => {
  const previousSecret = process.env.SECRET_ENV
  process.env.SECRET_ENV = "top-secret"

  try {
    const result = await runCommand({
      ...createEchoCommand("%SECRET_ENV%"),
      timeoutMs: 5_000,
    })

    expect(result.stdout).not.toContain("top-secret")
  } finally {
    if (previousSecret === undefined) delete process.env.SECRET_ENV
    else process.env.SECRET_ENV = previousSecret
  }
})

test("caps large command output", async () => {
  const result = await runCommand({
    ...createEchoCommand("x".repeat(1500)),
    timeoutMs: 5_000,
  })

  expect(result.stdout.length).toBeLessThanOrEqual(1100)
})

test("returns a timed out result for long-running commands", async () => {
  const result = await runCommand({
    ...createSleepCommand(),
    timeoutMs: 50,
  })

  expect(result.timedOut).toBe(true)
  expect(result.exitCode).toBeNull()
})

function createEchoCommand(message: string): Pick<Parameters<typeof runCommand>[0], "command" | "args"> {
  if (process.platform === "win32") {
    return { command: "cmd.exe", args: ["/c", "echo", message] }
  }

  return { command: "printf", args: [`${message}\n`] }
}

function createSleepCommand(): Pick<Parameters<typeof runCommand>[0], "command" | "args"> {
  if (process.platform === "win32") {
    return { command: "cmd.exe", args: ["/c", "ping", "-n", "6", "127.0.0.1"] }
  }

  return { command: "sh", args: ["-c", "sleep 2"] }
}
