import { expect, test } from "bun:test"

test("Docker control override mounts the Docker socket and enables container control", async () => {
  const compose = await Bun.file("deploy/server/docker-compose.control.yml").text()

  expect(compose).toContain("OPENCODE_CONTAINER_CONTROL_ENABLED: \"true\"")
  expect(compose).toContain("/var/run/docker.sock:/var/run/docker.sock")
})
