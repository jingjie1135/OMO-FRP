import { describe, expect, it } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

function collectFiles(dir: string, extension: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) return collectFiles(path, extension)
    return path.endsWith(extension) ? [path] : []
  })
}

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

describe("CLI naming docs", () => {
  it("keeps README validation commands on package scripts and the real bin entry", () => {
    const readme = readFileSync("README.md", "utf8")
    expect(readme).toContain("`opencode-remote` / `opencode-remote-platform`")
    expect(readme).toContain("bin/opencode-remote.js")
    expect(readme).toContain("bun run smoke")
    expect(readme).toContain("bun run typecheck")
    expect(readme).not.toContain("bun run src/cli-program.ts")
  })

  it("keeps package scripts aligned with README verification commands", () => {
    const readme = readFileSync("README.md", "utf8")
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts.test).toBe("bun test src/**/*.test.ts src/**/*.test.tsx")
    expect(packageJson.scripts.typecheck).toBe("tsc --noEmit")
    expect(packageJson.scripts.build).toBe("bun build src/cli-program.ts --outfile=dist/opencode-remote.js --target=bun")
    expect(packageJson.scripts.lint).toBe("bun run typecheck")

    expect(readme).toContain("bun test")
    expect(readme).toContain("bun run typecheck")
    expect(readme).toContain("bun run build")
    expect(readme).toContain("bun run lint")
  })

  it("does not document removed CLI source paths", () => {
    const files = ["README.md", ...collectFiles("docs", ".md")]
    const stalePaths = ["src/cli/index.ts", "src/cli/cli-program.ts"]

    for (const file of files) {
      const content = readFileSync(file, "utf8")
      for (const stalePath of stalePaths) {
        expect(content, `${file} should not mention ${stalePath}`).not.toContain(stalePath)
      }
    }
  })

  it("states oh-my-openagent only as an OpenCode plugin dependency", () => {
    const readme = readFileSync("README.md", "utf8")
    const cliReference = readFileSync("docs/reference/cli.md", "utf8")

    expect(readme).toContain("`oh-my-openagent` 只是在流程中可安装、可配置的 OpenCode 插件，不是平台本体")
    expect(cliReference).toContain("`oh-my-openagent` 不是本项目的 CLI")
  })
})
