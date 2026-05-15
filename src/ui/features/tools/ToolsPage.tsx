import React from "react"
import type { ToolDetection, ToolInstance } from "../../../management-api/types"
import { useToolsState, type ToolsState } from "./use-tools-state"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { ErrorState } from "../../components/ErrorState"
import type { ManagementClient } from "../../../management-api/client"

export interface ToolsPageProps {
  client: ManagementClient
}

export function ToolsPage({ client }: ToolsPageProps) {
  const state = useToolsState(client)

  if (state.isLoading && state.instances.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        <span>Loading tools...</span>
      </div>
    )
  }

  const detectStatus = state.getActionStatus("detect")
  const detectError = state.getActionError("detect")

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tools Management</h1>
        <div className="flex items-center space-x-2">
          <AsyncActionStatus status={detectStatus} />
          <button
            onClick={() => state.detect()}
            disabled={detectStatus === "pending"}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Detect Tools
          </button>
        </div>
      </div>

      {detectError && <ErrorState error={detectError} onRetry={() => state.detect()} />}

      <section aria-labelledby="detections-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="detections-heading" className="text-lg font-semibold mb-3">Tool Detections</h2>
        {state.detections.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Run detection to see available tools.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.detections.map((d) => (
              <DetectionCard key={d.kind} detection={d} state={state} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="instances-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="instances-heading" className="text-lg font-semibold mb-3">Tool Instances</h2>
        {state.instances.length === 0 ? (
          <div className="p-4 text-gray-500 italic border rounded bg-gray-50">
            tools:empty:no-tools-detected
          </div>
        ) : (
          <div className="space-y-4">
            {state.instances.map((instance) => (
              <InstanceRow
                key={instance.id}
                instance={instance}
                state={state}
                isSelected={state.selectedInstanceId === instance.id}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="logs-heading" className="bg-white p-4 rounded shadow border">
        <div className="flex items-center justify-between mb-3">
          <h2 id="logs-heading" className="text-lg font-semibold">
            Logs: {state.selectedInstanceId ? state.instances.find((instance) => instance.id === state.selectedInstanceId)?.displayName || state.selectedInstanceId : "No instance selected"}
          </h2>
          <button
            onClick={() => state.refreshLogs()}
            disabled={!state.selectedInstanceId}
            className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
          >
            Refresh Logs
          </button>
        </div>
        <div className="h-64 bg-slate-900 text-slate-300 p-2 font-mono text-xs rounded overflow-y-auto">
          {!state.selectedInstanceId ? (
            <span className="italic opacity-50">Select an instance to view logs.</span>
          ) : state.logs.length === 0 ? (
            <span className="italic opacity-50">No logs available for this instance.</span>
          ) : (
            state.logs.map((log) => (
              <div key={`${log.timestamp}-${log.level}-${log.message}`} className="mb-1 whitespace-pre-wrap">
                <span className="text-slate-500">[{log.timestamp}]</span>{" "}
                <span className={`font-bold ${getLogLevelClass(log.level)}`}>{log.level.toUpperCase()}</span>: {log.message}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function DetectionCard({ detection, state }: { detection: ToolDetection, state: ToolsState }) {
  const installStatus = state.getActionStatus("install")
  const installError = state.getActionError("install")
  const isInstalling = installStatus === "pending"
  const [confirmInstall, setConfirmInstall] = React.useState(false)
  const canInstallThisTool = !detection.detected && state.canInstallTools

  return (
    <div className="p-3 border rounded bg-gray-50 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium">{detection.displayName}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${detection.detected ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
            {detection.detected ? "Detected" : "Missing"}
          </span>
        </div>
        {detection.version && <div className="text-xs text-gray-500">Version: {detection.version}</div>}
      </div>

      {!detection.detected && (
        <div className="mt-3 border-t pt-3">
          {installError && <div className="mb-2"><ErrorState error={installError} /></div>}
          <dl className="mb-3 space-y-1 text-xs text-gray-600">
            <div><dt className="inline font-semibold">Install kind:</dt> <dd className="inline">{detection.kind}</dd></div>
            <div><dt className="inline font-semibold">Version:</dt> <dd className="inline">{detection.version ?? "runtime default"}</dd></div>
            <div><dt className="inline font-semibold">Target directory:</dt> <dd className="inline">{detection.configDirectory ?? "runtime managed"}</dd></div>
            <div><dt className="inline font-semibold">Binary path:</dt> <dd className="inline">{detection.binaryPath ?? "runtime managed"}</dd></div>
            <div><dt className="inline font-semibold">Affected paths:</dt> <dd className="inline">{[detection.binaryPath, detection.configDirectory].filter(Boolean).join(", ") || "runtime managed"}</dd></div>
          </dl>
          {!state.canInstallTools ? (
            <p className="mb-2 text-xs text-amber-700">Install unavailable: this runtime cannot install server services.</p>
          ) : confirmInstall ? (
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Confirm installation</p>
              <p className="text-xs text-amber-800">Install {detection.displayName} with the metadata shown above?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setConfirmInstall(false)
                    void state.install({ kind: detection.kind, version: detection.version, targetDirectory: detection.configDirectory })
                  }}
                  disabled={isInstalling}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isInstalling && <div className="animate-spin h-3 w-3 border-b-2 border-white rounded-full"></div>}
                  <span>Confirm Install</span>
                </button>
                <button
                  onClick={() => setConfirmInstall(false)}
                  disabled={isInstalling}
                  className="px-3 py-1 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : canInstallThisTool ? (
            <button
              onClick={() => setConfirmInstall(true)}
              disabled={isInstalling}
              className="w-full px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isInstalling && <div className="animate-spin h-3 w-3 border-b-2 border-white rounded-full"></div>}
              <span>Prepare Install</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

function InstanceRow({ instance, state, isSelected }: { instance: ToolInstance, state: ToolsState, isSelected: boolean }) {
  const startStatus = state.getActionStatus(`start:${instance.id}`)
  const stopStatus = state.getActionStatus(`stop:${instance.id}`)
  const restartStatus = state.getActionStatus(`restart:${instance.id}`)

  const startError = state.getActionError(`start:${instance.id}`)
  const stopError = state.getActionError(`stop:${instance.id}`)
  const restartError = state.getActionError(`restart:${instance.id}`)

  const isPending = startStatus === "pending" || stopStatus === "pending" || restartStatus === "pending"
  const processActionDisabled = isPending || !state.canManageToolProcesses

  return (
    <div className={`p-4 border rounded ${isSelected ? "ring-2 ring-blue-500 border-transparent" : "bg-gray-50"}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="cursor-pointer flex-1" onClick={() => state.selectInstance(instance.id)}>
          <div className="flex items-center space-x-2">
            <span className="font-bold">{instance.displayName}</span>
            <span className="text-xs text-gray-400 font-mono">{instance.id}</span>
            <StatusBadge status={instance.status} />
          </div>
          <div className="text-xs text-gray-500 mt-1 grid grid-cols-2 gap-x-4">
            <div>ID: {instance.id}</div>
            <div>Kind: {instance.kind}</div>
            <div>Host type: {instance.hostType}</div>
            <div>Install state: {instance.installState}</div>
            <div>Run state: {instance.status}</div>
            <div>Default port: {instance.defaultPort}</div>
            <div>Current port: {instance.currentPort ?? "not assigned"}</div>
            <div>Config dir: {instance.configDirectory ?? "not reported"}</div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <AsyncActionStatus status={startStatus || stopStatus || restartStatus} />
          {!state.canManageToolProcesses && <span className="text-xs text-amber-700">Process actions unavailable in this runtime.</span>}

          {instance.status !== "running" && (
            <button
              onClick={() => state.start(instance.id)}
              disabled={processActionDisabled}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Start
            </button>
          )}

          {instance.status === "running" && (
            <button
              onClick={() => state.stop(instance.id)}
              disabled={processActionDisabled}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              Stop
            </button>
          )}

          <button
            onClick={() => state.restart(instance.id)}
            disabled={processActionDisabled}
            className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
          >
            Restart
          </button>

          <button
            onClick={() => state.selectInstance(isSelected ? null : instance.id)}
            className={`px-3 py-1 rounded text-sm border ${isSelected ? "bg-blue-100 border-blue-300" : "bg-white border-gray-300"}`}
          >
            Logs
          </button>
        </div>
      </div>

      {(startError || stopError || restartError) && (
        <div className="mt-3">
          {startError && <ErrorState error={startError} onRetry={() => void state.start(instance.id)} />}
          {stopError && <ErrorState error={stopError} onRetry={() => void state.stop(instance.id)} />}
          {restartError && <ErrorState error={restartError} onRetry={() => void state.restart(instance.id)} />}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    running: "bg-green-100 text-green-700",
    stopped: "bg-gray-200 text-gray-600",
    error: "bg-red-100 text-red-700",
    starting: "bg-blue-100 text-blue-700",
  }[status] || "bg-gray-100 text-gray-600"

  return (
    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${colors}`}>
      {status}
    </span>
  )
}

function getLogLevelClass(level: string) {
  return {
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    debug: "text-slate-500",
  }[level] || "text-slate-300"
}
