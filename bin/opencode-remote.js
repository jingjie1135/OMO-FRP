#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const cli = join(root, "src", "cli-program.ts")
const runtime = process.env.BUN_BIN || "bun"
const result = spawnSync(runtime, [cli, ...process.argv.slice(2)], { stdio: "inherit" })

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
