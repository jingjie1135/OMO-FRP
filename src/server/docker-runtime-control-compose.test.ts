import { expect, test } from "bun:test"

test("server compose exposes Docker control settings without enabling the socket by default", async () => {
  const compose = await Bun.file("deploy/server/docker-compose.yml").text()

  expect(compose).toContain("OPENCODE_CONTAINER_CONTROL_ENABLED")
  expect(compose).toContain("OPENCODE_COMPOSE_PROJECT")
  expect(compose).toContain("OPENCODE_COMPOSE_SERVICE")
  expect(compose).not.toContain("/var/run/docker.sock")
})

test("env example keeps Docker container control disabled by default", async () => {
  const envExample = await Bun.file("deploy/server/.env.example").text()

  expect(envExample).toContain("OPENCODE_CONTAINER_CONTROL_ENABLED=false")
  expect(envExample).toContain("OPENCODE_COMPOSE_PROJECT=opencode-remote-platform")
  expect(envExample).toContain("OPENCODE_COMPOSE_SERVICE=opencode")
})
