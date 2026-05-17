import { describe, expect, it } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const root = process.cwd()

describe("frontend shell configuration", () => {
  it("defines Vite scripts for the management UI", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.["dev:ui"]).toBe("bunx --bun vite")
    expect(packageJson.scripts?.["build:ui"]).toBe("bunx --bun vite build")
  })

  it("configures Vite to serve src/ui and build into dist/ui", async () => {
    const viteConfig = await readFile(join(root, "vite.config.ts"), "utf8")

    expect(viteConfig).toContain('root: "src/ui"')
    expect(viteConfig).toContain('outDir: "../../dist/ui"')
    expect(viteConfig).toContain("port: 5173")
    expect(viteConfig).toContain("strictPort: true")
  })

  it("points the Tauri shell at the Vite dev server and dist/ui build", async () => {
    const tauriConfig = JSON.parse(await readFile(join(root, "src-tauri", "tauri.conf.json"), "utf8")) as {
      build?: {
        beforeDevCommand?: string
        beforeBuildCommand?: string
        devUrl?: string
        frontendDist?: string
      }
    }

    expect(tauriConfig.build?.beforeDevCommand).toBe("bun run --cwd .. dev:ui")
    expect(tauriConfig.build?.beforeBuildCommand).toBe("bun run --cwd .. build:ui")
    expect(tauriConfig.build?.devUrl).toBe("http://localhost:5173")
    expect(tauriConfig.build?.frontendDist).toBe("../dist/ui")
    expect((tauriConfig as { app?: { withGlobalTauri?: boolean } }).app?.withGlobalTauri).toBe(true)
  })

  it("provides a Vite HTML entry for the React management UI", async () => {
    const html = await readFile(join(root, "src", "ui", "index.html"), "utf8")

    expect(html).toContain('<div id="root"></div>')
    expect(html).toContain('<script type="module" src="/main.tsx"></script>')
  })

  it("renders the React app before loading Dashboard data", async () => {
    const mainSource = await readFile(join(root, "src", "ui", "main.tsx"), "utf8")

    expect(mainSource).toContain("createBrowserManagementClient")
    expect(mainSource).toContain("<ManagementDashboardApp client={client} />")
    expect(mainSource).not.toContain("loadDashboardViewModel")
  })
})
