import React from "react"
import { Box, Play, Plus, RotateCw, Search, Square, Terminal } from "lucide-react"
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
      <div className="p-8 flex items-center justify-center space-x-2 text-slate-500">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        <span>正在加载工具状态...</span>
      </div>
    )
  }

  const detectStatus = state.getActionStatus("detect")
  const detectError = state.getActionError("detect")

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 mt-1">管理系统内嵌的各类开发辅助工具和服务</p>
          <h1 className="text-2xl font-semibold text-slate-900">工具管理</h1>
        </div>
        <div className="flex items-center space-x-3">
          <AsyncActionStatus status={detectStatus} />
          <button
            onClick={() => state.detect()}
            disabled={detectStatus === "pending"}
            className="flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Search className="mr-2 h-4 w-4" />
            运行环境检测
          </button>
          <button
            type="button"
            onClick={() => state.detect()}
            disabled={detectStatus === "pending"}
            className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="mr-2 h-4 w-4" />
            安装新工具
          </button>
        </div>
      </div>

      {detectError && <ErrorState error={detectError} onRetry={() => state.detect()} />}

      <section aria-labelledby="detections-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="detections-heading" className="text-lg font-semibold mb-3">工具检测结果</h2>
        {state.detections.length === 0 ? (
          <p className="text-sm text-gray-500 italic">点击“检测工具”后可查看当前运行时识别到的工具。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.detections.map((d) => (
              <DetectionCard key={d.kind} detection={d} state={state} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="instances-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="instances-heading" className="text-lg font-semibold mb-3">工具实例</h2>
        {state.instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-gray-500">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Box className="h-6 w-6 text-slate-400" />
            </div>
            尚未发现可管理的工具实例。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {state.instances.map((instance) => (
              <ToolInstanceCard
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
            运行日志：{state.selectedInstanceId ? state.instances.find((instance) => instance.id === state.selectedInstanceId)?.displayName || state.selectedInstanceId : "未选择实例"}
          </h2>
          <button
            onClick={() => state.refreshLogs()}
            disabled={!state.selectedInstanceId}
            className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
          >
            刷新日志
          </button>
        </div>
        <div className="h-64 bg-slate-900 text-slate-300 p-2 font-mono text-xs rounded overflow-y-auto">
          {!state.selectedInstanceId ? (
            <span className="italic opacity-50">请选择一个实例以查看运行日志。</span>
          ) : state.logs.length === 0 ? (
            <span className="italic opacity-50">当前实例暂无可显示的日志。</span>
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
            {detection.detected ? "已检测" : "缺失"}
          </span>
        </div>
        {detection.version && <div className="text-xs text-gray-500">版本：{detection.version}</div>}
      </div>

      {!detection.detected && (
        <div className="mt-3 border-t pt-3">
          {installError && <div className="mb-2"><ErrorState error={installError} /></div>}
          <dl className="mb-3 space-y-1 text-xs text-gray-600">
            <div><dt className="inline font-semibold">安装类型：</dt> <dd className="inline">{detection.kind}</dd></div>
            <div><dt className="inline font-semibold">版本：</dt> <dd className="inline">{detection.version ?? "运行时默认"}</dd></div>
            <div><dt className="inline font-semibold">目标目录：</dt> <dd className="inline">{detection.configDirectory ?? "运行时管理"}</dd></div>
            <div><dt className="inline font-semibold">二进制路径：</dt> <dd className="inline">{detection.binaryPath ?? "运行时管理"}</dd></div>
            <div><dt className="inline font-semibold">影响路径：</dt> <dd className="inline">{[detection.binaryPath, detection.configDirectory].filter(Boolean).join(", ") || "运行时管理"}</dd></div>
          </dl>
          {!state.canInstallTools ? (
            <p className="mb-2 text-xs text-amber-700">当前运行时不允许直接安装服务器侧工具。</p>
          ) : confirmInstall ? (
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">确认安装</p>
              <p className="text-xs text-amber-800">是否按以上参数安装 {detection.displayName}？</p>
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
                  <span>确认安装</span>
                </button>
                <button
                  onClick={() => setConfirmInstall(false)}
                  disabled={isInstalling}
                  className="px-3 py-1 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  取消
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
              <span>准备安装</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ToolInstanceCard({ instance, state, isSelected }: { instance: ToolInstance, state: ToolsState, isSelected: boolean }) {
  const startStatus = state.getActionStatus(`start:${instance.id}`)
  const stopStatus = state.getActionStatus(`stop:${instance.id}`)
  const restartStatus = state.getActionStatus(`restart:${instance.id}`)

  const startError = state.getActionError(`start:${instance.id}`)
  const stopError = state.getActionError(`stop:${instance.id}`)
  const restartError = state.getActionError(`restart:${instance.id}`)

  const isPending = startStatus === "pending" || stopStatus === "pending" || restartStatus === "pending"
  const processActionDisabled = isPending || !state.canManageToolProcesses

  return (
    <article data-testid={`tool-card-${instance.id}`} className={`flex flex-col rounded-xl border bg-white p-6 shadow-sm ${isSelected ? "ring-2 ring-blue-500 border-transparent" : "border-slate-200"}`}>
      <div className="mb-6 flex items-start justify-between">
        <button type="button" className="flex items-center text-left" onClick={() => state.selectInstance(instance.id)}>
          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 font-mono text-xl font-bold text-blue-600">
            {instance.displayName.charAt(0)}
          </div>
          <div>
            <h3 className="font-medium text-slate-800">{instance.displayName}</h3>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{instance.id}</p>
          </div>
        </button>
        <StatusBadge status={instance.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
        <div><dt className="inline font-medium">类型：</dt><dd className="inline">{instance.kind}</dd></div>
        <div><dt className="inline font-medium">主机：</dt><dd className="inline">{instance.hostType}</dd></div>
        <div><dt className="inline font-medium">安装：</dt><dd className="inline">{instance.installState}</dd></div>
        <div><dt className="inline font-medium">端口：</dt><dd className="inline">{instance.currentPort ?? instance.defaultPort ?? "未分配"}</dd></div>
        {instance.configDirectory && <div className="col-span-2 truncate"><dt className="inline font-medium">配置：</dt><dd className="inline">{instance.configDirectory}</dd></div>}
      </dl>

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-6">
        <div className="flex space-x-2">
          <AsyncActionStatus status={startStatus || stopStatus || restartStatus} />
          {!state.canManageToolProcesses && <span className="text-xs text-amber-700">当前运行时不支持直接管理进程。</span>}

          {instance.status !== "running" && (
            <button
              onClick={() => state.start(instance.id)}
              disabled={processActionDisabled}
              title="启动"
              className="rounded border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-600 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
            </button>
          )}

          {instance.status === "running" && (
            <button
              onClick={() => state.stop(instance.id)}
              disabled={processActionDisabled}
              title="停止"
              className="rounded border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600 disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => state.restart(instance.id)}
            disabled={processActionDisabled}
            title="重启"
            className="rounded border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-600 disabled:opacity-50"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        <button onClick={() => state.selectInstance(isSelected ? null : instance.id)} className="flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700">
          <Terminal className="mr-1 h-4 w-4" />
          查看日志
        </button>
      </div>

      {(startError || stopError || restartError) && (
        <div className="mt-3">
          {startError && <ErrorState error={startError} onRetry={() => void state.start(instance.id)} />}
          {stopError && <ErrorState error={stopError} onRetry={() => void state.stop(instance.id)} />}
          {restartError && <ErrorState error={restartError} onRetry={() => void state.restart(instance.id)} />}
        </div>
      )}
    </article>
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
      {formatStatusLabel(status)}
    </span>
  )
}

function formatStatusLabel(status: string) {
  return {
    running: "运行中",
    stopped: "已停止",
    error: "错误",
    starting: "启动中",
  }[status] ?? status
}

function getLogLevelClass(level: string) {
  return {
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    debug: "text-slate-500",
  }[level] || "text-slate-300"
}
