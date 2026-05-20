import { expect, test } from "bun:test"

test("install script copies the Docker control override for explicit opt-in use", async () => {
  const installScript = await Bun.file("deploy/server/install.sh").text()

  expect(installScript).toContain("docker-compose.control.yml")
})

test("server deployment guide documents Docker control as an explicit opt-in", async () => {
  const guide = await Bun.file("docs/guide/server-deployment.md").text()

  expect(guide).toContain("docker-compose.control.yml")
  expect(guide).toContain("OPENCODE_CONTAINER_CONTROL_ENABLED=true")
  expect(guide).toContain("MANAGEMENT_API_SESSION_TOKEN")
  expect(guide).toContain("Docker socket")
})
