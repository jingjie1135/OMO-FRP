import React from "react"
import type { PublicEndpoint } from "../../../core/app-config/types"
import { validateEndpoint } from "../../../core/endpoints/endpoint-service"

export interface EndpointsPageState {
  endpoints: PublicEndpoint[]
  loading?: boolean
  error?: string
}

export function EndpointsPage(state: EndpointsPageState) {
  if (state.loading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center text-gray-500 min-h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <span className="animate-pulse">endpoints:loading</span>
      </div>
    )
  }

  if (state.error) {
    return (
      <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
        <h2 className="font-bold mb-2">Endpoints Error</h2>
        endpoints:error:{state.error}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Public Endpoints</h1>
      </div>

      <section aria-labelledby="endpoint-list-heading" className="bg-white rounded shadow border overflow-hidden">
        <h2 id="endpoint-list-heading" className="text-lg font-semibold p-4 bg-gray-50 border-b">Endpoint List</h2>
        {state.endpoints.length === 0 ? (
          <div className="p-4 text-gray-500 italic">endpoints:empty</div>
        ) : (
          <ul className="divide-y">
            {state.endpoints.map((endpoint) => {
              const validation = validateEndpoint({ ...endpoint, status: endpoint.status === "active" ? "active" : endpoint.status })
              const validationState = validation.ok ? "ok" : validation.issues.map((issue) => issue.code).join(",")
              return (
                <li key={endpoint.id} className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-mono text-sm">{endpoint.name}:{endpoint.status}:{endpoint.targetType}:{validationState}</p>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-gray-100 text-xs rounded border">validation:{validationState}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="endpoint-editor-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="endpoint-editor-heading" className="text-lg font-semibold mb-3">Create / Edit Endpoint</h2>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 border rounded italic text-sm text-gray-500">
            Endpoint editor form and actions will be wired in the next development phase (Task 3).
          </div>
          <button disabled className="px-4 py-2 bg-blue-600 text-white rounded opacity-50 cursor-not-allowed">
            + New Endpoint
          </button>
        </div>
      </section>

      <section aria-labelledby="endpoint-validation-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="endpoint-validation-heading" className="text-lg font-semibold mb-3">Endpoint Validation</h2>
        <div className="text-sm text-slate-600">
          <p>Validation Status: {state.endpoints.every(e => validateEndpoint(e).ok) ? "All endpoints valid" : "Some endpoints require attention"}</p>
          <ul className="mt-2 list-disc list-inside">
            <li>Safety check: DNS resolution verify</li>
            <li>Security check: Auth mode enforcement</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="endpoint-enable-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="endpoint-enable-heading" className="text-lg font-semibold mb-3">Enable Endpoint</h2>
        <div className="space-y-2">
          <p className="text-sm text-gray-500 italic">Safety checks and background provisioning are required before enabling endpoints.</p>
          <button disabled className="px-3 py-1 text-sm border rounded opacity-50 cursor-not-allowed">
            Enable Selected
          </button>
        </div>
      </section>

      <section aria-labelledby="endpoint-disable-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="endpoint-disable-heading" className="text-lg font-semibold mb-3">Disable Endpoint</h2>
        <div className="space-y-2">
          <p className="text-sm text-gray-500 italic">Active tunnels will be gracefully disconnected upon disablement.</p>
          <button disabled className="px-3 py-1 text-sm bg-red-50 text-red-600 border border-red-100 rounded opacity-50 cursor-not-allowed">
            Disable Selected
          </button>
        </div>
      </section>

      <section aria-labelledby="diagnostics-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="diagnostics-heading" className="text-lg font-semibold mb-3">Network Diagnostics</h2>
        <div className="text-sm text-slate-600">
          Global reachability check is available for all active endpoints.
        </div>
      </section>
    </div>
  )
}
