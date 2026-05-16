import { useState } from "react"
import type { PublicEndpoint, RuntimeInfo } from "../../../core/app-config/types"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { ErrorState } from "../../components/ErrorState"
import { formatEndpointPublicAddress } from "../../../core/endpoints/endpoint-service"
import { EndpointForm } from "./EndpointForm"
import type { EndpointDiagnostics, EndpointSafetyCheck } from "./use-endpoints-state"

export interface EndpointsPageState {
  endpoints: PublicEndpoint[]
  runtimeInfo?: RuntimeInfo
  loading?: boolean
  error?: string
  saveEndpoint: (endpoint: PublicEndpoint) => Promise<void>
  enableEndpoint: (id: string) => Promise<void>
  disableEndpoint: (id: string) => Promise<void>
  checkSafety: (endpoint: PublicEndpoint) => EndpointSafetyCheck
  getDiagnostics?: (endpoint: PublicEndpoint) => EndpointDiagnostics
  getActionStatus?: (key: string) => "idle" | "pending" | "succeeded" | "failed"
  getActionError?: (key: string) => { message: string; retryable?: boolean; needsReauth?: boolean; status?: number; target?: string } | undefined
}

export function EndpointsPage({
  endpoints,
  runtimeInfo,
  loading,
  error,
  saveEndpoint,
  enableEndpoint,
  disableEndpoint,
  checkSafety,
  getDiagnostics,
  getActionStatus,
  getActionError,
}: EndpointsPageState) {
  const [editingEndpoint, setEditingEndpoint] = useState<PublicEndpoint | Partial<PublicEndpoint> | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center text-gray-500 min-h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
        <span className="animate-pulse">Loading endpoints...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
        <h2 className="font-bold mb-2">Endpoints Error</h2>
        <p>Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Endpoints</h1>
        <button
          onClick={() => {
            setPageError(null)
            setEditingEndpoint({ status: "disabled" })
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Endpoint
        </button>
      </div>

      {pageError && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {editingEndpoint && runtimeInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-lg w-full">
            <EndpointForm
              endpoint={editingEndpoint}
              runtimeInfo={runtimeInfo}
              onSave={async (ep) => {
                try {
                  await saveEndpoint(ep)
                  setEditingEndpoint(null)
                  setPageError(null)
                } catch (error: unknown) {
                  setPageError(getErrorMessage(error))
                }
              }}
              onCancel={() => setEditingEndpoint(null)}
            />
          </div>
        </div>
      )}

      <section aria-labelledby="endpoint-list-heading" className="bg-white border rounded-lg overflow-hidden">
        <h2 id="endpoint-list-heading" className="text-lg font-semibold p-4 bg-gray-50 border-b">Endpoint List</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID / Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL / Domain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {endpoints.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  No endpoints configured.
                </td>
              </tr>
            ) : (
              endpoints.map((endpoint) => {
                const safety = checkSafety({ ...endpoint, status: "active" })
                const enableStatus = getActionStatus?.(`enable-endpoint-${endpoint.id}`) ?? "idle"
                const disableStatus = getActionStatus?.(`disable-endpoint-${endpoint.id}`) ?? "idle"
                const enableError = getActionError?.(`enable-endpoint-${endpoint.id}`)
                const disableError = getActionError?.(`disable-endpoint-${endpoint.id}`)
                const actionPending = enableStatus === "pending" || disableStatus === "pending"
                return (
                  <tr key={endpoint.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{endpoint.name}</div>
                      <div className="text-xs text-gray-500">{endpoint.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatEndpointPublicAddress(endpoint)}
                      </div>
                      <div className="text-xs text-gray-500">{endpoint.authMode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{endpoint.targetType}</div>
                      <div className="text-xs text-gray-500">{endpoint.targetToolInstanceId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          endpoint.status === "active"
                            ? "bg-green-100 text-green-800"
                            : endpoint.status === "error"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {endpoint.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <AsyncActionStatus status={enableStatus === "idle" ? disableStatus : enableStatus} />
                      <button
                        onClick={() => setEditingEndpoint(endpoint)}
                        disabled={actionPending}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      {endpoint.status === "active" ? (
                        <button
                          onClick={async () => {
                            if (window.confirm("Disable this endpoint and preserve its configuration?")) {
                              try {
                                await disableEndpoint(endpoint.id)
                                setPageError(null)
                              } catch (error: unknown) {
                                setPageError(getErrorMessage(error))
                              }
                            }
                          }}
                          disabled={actionPending}
                          className="text-red-600 hover:text-red-900"
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            const publicAddress = formatEndpointPublicAddress(endpoint)
                            const confirmed = window.confirm(`Enable public endpoint ${endpoint.name}?\n\nPublic address: ${publicAddress}\nAuth mode: ${endpoint.authMode}\n\nConfirm that access protection is configured before exposing this endpoint.`)
                            if (!confirmed) return
                            try {
                              await enableEndpoint(endpoint.id)
                              setPageError(null)
                            } catch (error: unknown) {
                              setPageError(getErrorMessage(error))
                            }
                          }}
                          disabled={!safety.ok || actionPending}
                          title={safety.suggestion}
                          className={`${
                            safety.ok ? "text-green-600 hover:text-green-900" : "text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          Enable
                        </button>
                      )}
                      {(enableError || disableError) && (
                        <div className="mt-2 text-left">
                          {enableError && <ErrorState error={enableError} onRetry={() => void enableEndpoint(endpoint.id)} />}
                          {disableError && <ErrorState error={disableError} onRetry={() => void disableEndpoint(endpoint.id)} />}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="endpoint-editor-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="endpoint-editor-heading" className="text-lg font-semibold mb-3">Create / Edit Endpoint</h2>
        <p className="text-sm text-gray-600">Use Create Endpoint or Edit to manage endpoint name, public address, protocol, target type, target instance, and auth mode. New endpoints are saved as disabled until safety checks pass.</p>
      </section>

      <section aria-labelledby="endpoint-validation-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="endpoint-validation-heading" className="text-lg font-semibold mb-3">Endpoint Validation</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          {endpoints.length === 0 ? (
            <li>No endpoint validation issues because no endpoints are configured.</li>
          ) : endpoints.map((endpoint) => {
            const safety = checkSafety({ ...endpoint, status: "active" })
            return (
              <li key={`validation-${endpoint.id}`}>
                <span className="font-medium">{endpoint.name}</span>: {safety.ok ? "Ready to enable" : safety.issues.join(" ")}
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="endpoint-enable-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="endpoint-enable-heading" className="text-lg font-semibold mb-3">Enable Endpoint</h2>
        <p className="text-sm text-gray-600">Enable is blocked until OpenCode is running, auth is configured, the provider is available, the target port is known, and no conflicting active endpoint exists.</p>
      </section>

      <section aria-labelledby="endpoint-disable-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="endpoint-disable-heading" className="text-lg font-semibold mb-3">Disable Endpoint</h2>
        <p className="text-sm text-gray-600">Disable requires confirmation and keeps the endpoint configuration for later reuse.</p>
      </section>

      <section aria-labelledby="diagnostics-heading" className="space-y-4">
        <h2 id="diagnostics-heading" className="text-xl font-semibold">Diagnostics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {endpoints.map((endpoint) => {
            const diagnostics = getDiagnostics?.(endpoint) ?? createFallbackDiagnostics(endpoint, runtimeInfo, checkSafety)
            const targetTool = runtimeInfo?.config.toolInstances.find((t) => t.id === endpoint.targetToolInstanceId)

            return (
              <div key={`diag-${endpoint.id}`} className="border rounded-lg p-4 bg-gray-50 space-y-2">
                <h3 className="font-medium text-gray-900">{endpoint.name}</h3>
                <ul className="text-sm space-y-1">
                  <li className="flex justify-between">
                    <span>Target Running:</span>
                    <span className={diagnostics.targetRunning ? "text-green-600" : "text-red-600"}>
                      {targetTool?.status || "unknown"}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Local Port:</span>
                    <span>{diagnostics.localPort ?? "N/A"}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>FRP / Cloudflare:</span>
                    <span className={diagnostics.providerAvailable ? "text-green-600" : "text-red-600"}>
                      {diagnostics.providerAvailable ? "available" : "unavailable"}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Auth completeness:</span>
                    <span className={diagnostics.authComplete ? "text-green-600" : "text-red-600"}>
                      {diagnostics.authComplete ? "complete" : "incomplete"}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Safety Check:</span>
                    <span className={diagnostics.fixSuggestion === "Endpoint is ready to enable." ? "text-green-600" : "text-red-600"}>
                      {diagnostics.fixSuggestion === "Endpoint is ready to enable." ? "Pass" : "Fail"}
                    </span>
                  </li>
                  {diagnostics.recentError && <li className="text-xs text-amber-700">Recent error: {diagnostics.recentError}</li>}
                  {diagnostics.fixSuggestion !== "Endpoint is ready to enable." && (
                    <li className="text-xs text-red-500 bg-red-50 p-1 rounded">
                      <strong>Fix suggestion:</strong> {diagnostics.fixSuggestion}
                    </li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function createFallbackDiagnostics(
  endpoint: PublicEndpoint,
  runtimeInfo: RuntimeInfo | undefined,
  checkSafety: (endpoint: PublicEndpoint) => EndpointSafetyCheck,
): EndpointDiagnostics {
  const targetTool = runtimeInfo?.config.toolInstances.find((tool) => tool.id === endpoint.targetToolInstanceId)
  const safety = checkSafety(endpoint)
  return {
    targetRunning: targetTool?.status === "running",
    localPort: targetTool?.currentPort ?? targetTool?.defaultPort ?? null,
    providerAvailable: Boolean(runtimeInfo),
    authComplete: endpoint.authMode === "opencode-password" || endpoint.authMode === "both",
    publicAddressGeneratable: true,
    conflictFree: true,
    recentError: endpoint.status === "error" ? safety.issues.join(" ") : null,
    fixSuggestion: safety.suggestion,
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Endpoint action failed."
}
