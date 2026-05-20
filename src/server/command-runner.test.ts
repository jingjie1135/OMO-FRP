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

function createEchoCommand(message: string): Pick<Parameters<typeof runCommand>[0], "command" | "args"> {
  if (process.platform === "win32") {
    return { command: "cmd.exe", args: ["/c", "echo", message] }
  }

  return { command: "printf", args: [`${message}\n`] }
}
