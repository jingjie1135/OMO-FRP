import React from "react"
import { Box, Play, Plus, RotateCw, Search, Square, Terminal } from "lucide-react"
import type { ToolDetection, ToolInstance } from "../../../management-api/types"
import { useToolsState, type ToolsState } from "./use-tools-state"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { ErrorState } from "../../components/ErrorState"
import type { ManagementClient } from "../../../management-api/client"
import { ActionButton, EmptyState, PageHeader, SectionCard, StatusBadge } from "../../components/FomoPrimitives"

export interface ToolsPageProps {
  client: ManagementClient
}

export function ToolsPage({ client }: ToolsPageProps) {
  const state = useToolsState(client)

  if (state.isLoading && state.instances.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-slate-900" />
        <span>正在加载工具状态...</span>
      </div>
    )
  }

  const detectStatus = state.getActionStatus("detect")
  const detectError = state.getActionError("detect")

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        eyebrow="工具运行中心"
        title="工具管理"
        description="管理系统内嵌的各类开发辅助工具和服务。"
        action={(
          <>
          <AsyncActionStatus status={detectStatus} />
          <ActionButton
            onClick={() => state.detect()}
            disabled={detectStatus === "pending"}
            tone="secondary"
          >
            <Search className="mr-2 h-4 w-4" />
            运行环境检测
          </ActionButton>
          <ActionButton
            onClick={() => state.detect()}
            disabled={detectStatus === "pending"}
            tone="primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            安装新工具
          </ActionButton>
          </>
        )}
      />

      {detectError && <ErrorState error={detectError} onRetry={() => state.detect()} />}

      <SectionCard title="工具检测结果" description="检测本机或服务器运行时中可用的 OpenCode、FRP 与辅助工具。">
        <h2 id="detections-heading" className="sr-only">工具检测结果</h2>
        {state.detections.length === 0 ? (
          <p className="text-sm text-slate-500">点击“运行环境检测”后可查看当前运行时识别到的工具。</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {state.detections.map((d) => (
              <DetectionCard key={d.kind} detection={d} state={state} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="工具实例" description="查看受管工具实例、进程状态、端口与配置目录。">
        <h2 id="instances-heading" className="sr-only">工具实例</h2>
        {state.instances.length === 0 ? (
          <EmptyState icon={<Box className="h-6 w-6" />} title="尚未发现可管理的工具实例" description="运行环境检测后，如果发现 OpenCode、frpc 或 cloudflared，会在这里显示实例和操作入口。" />
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
      </SectionCard>

      <SectionCard
        title={`运行日志：${state.selectedInstanceId ? state.instances.find((instance) => instance.id === state.selectedInstanceId)?.displayName || state.selectedInstanceId : "未选择实例"}`}
        description="选择工具实例后查看最近运行日志。"
        action={(
          <ActionButton
            onClick={() => state.refreshLogs()}
            disabled={!state.selectedInstanceId}
            tone="secondary"
          >
            刷新日志
          </ActionButton>
        )}
      >
        <h2 id="logs-heading" className="sr-only">运行日志</h2>
        <div className="h-64 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs text-slate-300 shadow-inner">
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
      </SectionCard>
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
    <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-slate-800">{detection.displayName}</span>
          <StatusBadge tone={detection.detected ? "success" : "neutral"}>{detection.detected ? "已检测" : "缺失"}</StatusBadge>
        </div>
        {detection.version && <div className="text-xs text-slate-500">版本：{detection.version}</div>}
      </div>

      {!detection.detected && (
        <div className="mt-3 border-t pt-3">
          {installError && <div className="mb-2"><ErrorState error={installError} /></div>}
          <dl className="mb-3 space-y-1 text-xs text-slate-600">
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
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isInstalling && <div className="animate-spin h-3 w-3 border-b-2 border-white rounded-full"></div>}
                  <span>确认安装</span>
                </button>
                <button
                  onClick={() => setConfirmInstall(false)}
                  disabled={isInstalling}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          ) : canInstallThisTool ? (
            <button
              onClick={() => setConfirmInstall(true)}
              disabled={isInstalling}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
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
        <ToolStatusBadge status={instance.status} />
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

function ToolStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusToneClass(status)}`}>
      {formatStatusLabel(status)}
    </span>
  )
}

function getStatusToneClass(status: string) {
  return {
    running: "bg-emerald-100 text-emerald-700",
    stopped: "bg-slate-100 text-slate-600",
    error: "bg-red-100 text-red-700",
    starting: "bg-blue-100 text-blue-700",
  }[status] || "bg-slate-100 text-slate-600"
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
