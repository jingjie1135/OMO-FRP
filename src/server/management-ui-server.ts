import { extname, join, relative, resolve } from "node:path"
import { createServerApi, type ServerApi } from "./api"
import { createPersistedServerRuntimeAdapter } from "./runtime-adapter"

export interface ManagementUiRequestHandlerOptions {
  staticRoot?: string
  api?: ServerApi
}

export type ManagementUiRequestHandler = (request: Request) => Promise<Response>

const defaultStaticRoot = resolve(process.cwd(), "dist", "ui")

export function createManagementUiRequestHandler(options: ManagementUiRequestHandlerOptions = {}): ManagementUiRequestHandler {
  const staticRoot = resolve(options.staticRoot ?? defaultStaticRoot)
  const api = options.api
  const apiPromise = api
    ? Promise.resolve(api)
    : createPersistedServerRuntimeAdapter().then((adapter) => createServerApi({
      adapter,
      sessionToken: process.env.MANAGEMENT_API_SESSION_TOKEN,
    }))

  return async function handleManagementUiRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith("/api/")) {
      return (await apiPromise).request(`${url.pathname}${url.search}`, await toRequestInit(request))
    }

    if (isAssetRequest(url.pathname)) {
      const assetResponse = await serveStaticFile(staticRoot, url.pathname)
      return assetResponse ?? new Response("Not found", { status: 404 })
    }

    const indexResponse = await serveStaticFile(staticRoot, "/index.html")
    return indexResponse ?? new Response("Management UI build is missing", { status: 503 })
  }
}

export function startManagementUiServer(): void {
  const host = process.env.MANAGEMENT_UI_HOST ?? "0.0.0.0"
  const port = parsePort(process.env.MANAGEMENT_UI_PORT ?? "4080")
  const staticRoot = process.env.MANAGEMENT_UI_STATIC_ROOT ?? defaultStaticRoot
  const handler = createManagementUiRequestHandler({ staticRoot })

  Bun.serve({
    hostname: host,
    port,
    fetch: handler,
  })

  console.log(`management UI server listening on http://${host}:${port}`)
}

async function toRequestInit(request: Request): Promise<RequestInit> {
  const method = request.method.toUpperCase()
  return {
    method,
    headers: request.headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.text(),
  }
}

async function serveStaticFile(staticRoot: string, requestPath: string): Promise<Response | null> {
  const resolved = resolveStaticPath(staticRoot, requestPath)
  if (resolved.status === 400) {
    return new Response("Bad request", { status: 400 })
  }

  if (!resolved.filePath) {
    return null
  }

  const filePath = resolved.filePath
  const file = Bun.file(filePath)
  if (!(await file.exists())) {
    return null
  }

  return new Response(await file.arrayBuffer(), { headers: { "content-type": getContentType(filePath) } })
}

function resolveStaticPath(staticRoot: string, requestPath: string): { filePath: string | null; status?: 400 } {
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(requestPath)
  } catch {
    return { filePath: null, status: 400 }
  }

  const normalizedPath = decodedPath.replace(/^\/+/, "")
  const filePath = resolve(join(staticRoot, normalizedPath))
  const relativePath = relative(staticRoot, filePath)
  if (relativePath === "" || (!relativePath.startsWith("..") && !relativePath.includes(":") && !relativePath.startsWith("/"))) {
    return { filePath }
  }

  return { filePath: null }
}

function isAssetRequest(pathname: string): boolean {
  return extname(pathname) !== ""
}

function getContentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8"
    case ".js":
      return "text/javascript; charset=utf-8"
    case ".css":
      return "text/css; charset=utf-8"
    case ".json":
      return "application/json; charset=utf-8"
    case ".svg":
      return "image/svg+xml"
    case ".png":
      return "image/png"
    case ".ico":
      return "image/x-icon"
    default:
      return "application/octet-stream"
  }
}

function parsePort(value: string): number {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid MANAGEMENT_UI_PORT: ${value}`)
  }
  return port
}

if (import.meta.main) {
  startManagementUiServer()
}
