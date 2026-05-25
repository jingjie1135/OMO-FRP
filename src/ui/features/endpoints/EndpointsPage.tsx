import { useState } from "react"
import { Check, Shield, ShieldAlert, ShieldCheck, X } from "lucide-react"
import type { PublicEndpoint, RuntimeInfo } from "../../../core/app-config/types"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { ErrorState } from "../../components/ErrorState"
import { formatEndpointPublicAddress } from "../../../core/endpoints/endpoint-service"
import { EndpointForm } from "./EndpointForm"
import type { EndpointDiagnostics, EndpointSafetyCheck } from "./use-endpoints-state"
import { ActionButton, EmptyState, PageHeader, SectionCard, StatusBadge } from "../../components/FomoPrimitives"

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
  const [securityCheckEndpoint, setSecurityCheckEndpoint] = useState<PublicEndpoint | null>(null)

  if (loading) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center p-8 text-slate-500">
        <div className="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        <span className="animate-pulse">正在加载公网入口...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="m-8 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        <h2 className="font-bold mb-2">公网入口错误</h2>
        <p>错误：{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        eyebrow="公网地址、路由与验收"
        title="公网入口"
        description="集中管理 OpenCode 的公网路由、认证策略和启用前安全检查。"
        action={(
          <ActionButton
            tone="primary"
            onClick={() => {
            setPageError(null)
            setEditingEndpoint({ status: "disabled" })
          }}
          >
            新建入口
          </ActionButton>
        )}
      />

      {pageError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {editingEndpoint && runtimeInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
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

      {securityCheckEndpoint && (
        <EndpointSecurityModal
          endpoint={securityCheckEndpoint}
          safety={checkSafety({ ...securityCheckEndpoint, status: "active" })}
          onClose={() => setSecurityCheckEndpoint(null)}
          onConfirm={async () => {
            try {
              await enableEndpoint(securityCheckEndpoint.id)
              setSecurityCheckEndpoint(null)
              setPageError(null)
            } catch (error: unknown) {
              setPageError(getErrorMessage(error))
            }
          }}
        />
      )}

      <SectionCard title="入口列表" description="查看每个公网入口的公开地址、目标工具、认证方式和启用状态。">
        <h2 id="endpoint-list-heading" className="sr-only">入口列表</h2>
        {endpoints.length === 0 ? (
          <EmptyState title="还没有配置任何公网入口" description="新建入口后会在这里显示公网地址、安全状态和启停操作。" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">名称 / ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">公网域名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">目标</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">状态</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {endpoints.map((endpoint) => {
                const safety = checkSafety({ ...endpoint, status: "active" })
                const enableStatus = getActionStatus?.(`enable-endpoint-${endpoint.id}`) ?? "idle"
                const disableStatus = getActionStatus?.(`disable-endpoint-${endpoint.id}`) ?? "idle"
                const enableError = getActionError?.(`enable-endpoint-${endpoint.id}`)
                const disableError = getActionError?.(`disable-endpoint-${endpoint.id}`)
                const actionPending = enableStatus === "pending" || disableStatus === "pending"
                const statusLabel = endpoint.status === "active" ? "已启用" : endpoint.status === "error" ? "异常" : "未启用"
                return (
                  <tr key={endpoint.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{endpoint.name}</div>
                      <div className="font-mono text-xs text-slate-500">{endpoint.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">
                        {formatEndpointPublicAddress(endpoint)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatAuthModeLabel(endpoint.authMode)} · <span className="font-mono">{endpoint.authMode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{formatTargetTypeLabel(endpoint.targetType)}</div>
                      <div className="font-mono text-xs text-slate-500">{endpoint.targetType} · {endpoint.targetToolInstanceId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge tone={getEndpointStatusTone(endpoint.status)}>{statusLabel}</StatusBadge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                      <AsyncActionStatus status={enableStatus === "idle" ? disableStatus : enableStatus} />
                      <ActionButton
                        onClick={() => setEditingEndpoint(endpoint)}
                        disabled={actionPending}
                        tone="secondary"
                        className="px-3 py-1.5"
                      >
                        编辑
                      </ActionButton>
                      {endpoint.status === "active" ? (
                        <ActionButton
                          onClick={async () => {
                            if (window.confirm("确认停用这个公网入口并保留当前配置吗？")) {
                              try {
                                await disableEndpoint(endpoint.id)
                                setPageError(null)
                              } catch (error: unknown) {
                                setPageError(getErrorMessage(error))
                              }
                            }
                          }}
                          disabled={actionPending}
                          tone="danger"
                          className="px-3 py-1.5"
                        >
                          停用
                        </ActionButton>
                      ) : (
                        <ActionButton
                          onClick={() => {
                            setSecurityCheckEndpoint(endpoint)
                          }}
                          disabled={actionPending}
                          title={safety.suggestion}
                          tone={safety.ok ? "success" : "secondary"}
                          className="px-3 py-1.5"
                        >
                          启用
                        </ActionButton>
                      )}
                      </div>
                      {(enableError || disableError) && (
                        <div className="mt-2 text-left">
                          {enableError && <ErrorState error={enableError} onRetry={() => void enableEndpoint(endpoint.id)} />}
                          {disableError && <ErrorState error={disableError} onRetry={() => void disableEndpoint(endpoint.id)} />}
                        </div>
                      )}
                    </td>
                  </tr>
                )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="创建 / 编辑入口" description="通过“新建入口”或“编辑”管理入口名称、公开地址、协议、目标类型、目标实例和认证模式。新入口在安全检查通过前会保持为停用状态。">
        <h2 id="endpoint-editor-heading" className="sr-only">创建 / 编辑入口</h2>
      </SectionCard>

      <SectionCard title="入口校验" description="启用前持续展示每个入口的安全检查结果。">
        <h2 id="endpoint-validation-heading" className="sr-only">入口校验</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          {endpoints.length === 0 ? (
            <li>当前没有入口，因此暂无校验问题。</li>
          ) : endpoints.map((endpoint) => {
            const safety = checkSafety({ ...endpoint, status: "active" })
            return (
              <li key={`validation-${endpoint.id}`}>
                <span className="font-medium">{endpoint.name}</span>：{safety.ok ? "满足启用条件" : safety.issues.join(" ")}
              </li>
            )
          })}
        </ul>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionCard title="启用条件">
          <h2 id="endpoint-enable-heading" className="sr-only">启用条件</h2>
          <p className="text-sm text-slate-600">只有在 OpenCode 正常运行、认证已配置、提供方可用、目标端口已知且不存在冲突的已启用入口时，才允许启用。</p>
        </SectionCard>

        <SectionCard title="停用行为">
          <h2 id="endpoint-disable-heading" className="sr-only">停用行为</h2>
          <p className="text-sm text-slate-600">停用需要确认，但会保留当前入口配置，方便后续再次启用。</p>
        </SectionCard>
      </div>

      <SectionCard title="诊断信息" description="按入口查看目标运行状态、端口、提供方可用性和修复建议。">
        <h2 id="diagnostics-heading" className="sr-only">诊断信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {endpoints.map((endpoint) => {
            const diagnostics = getDiagnostics?.(endpoint) ?? createFallbackDiagnostics(endpoint, runtimeInfo, checkSafety)
            const targetTool = runtimeInfo?.config.toolInstances.find((t) => t.id === endpoint.targetToolInstanceId)

            return (
              <div key={`diag-${endpoint.id}`} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-medium text-slate-900">{endpoint.name}</h3>
                <ul className="text-sm space-y-1">
                  <li className="flex justify-between">
                    <span>目标运行状态：</span>
                    <span className={diagnostics.targetRunning ? "text-emerald-600" : "text-red-600"}>
                      {targetTool?.status || "unknown"}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>本地端口：</span>
                    <span>{diagnostics.localPort ?? "N/A"}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>FRP / Cloudflare：</span>
                    <span className={diagnostics.providerAvailable ? "text-emerald-600" : "text-red-600"}>
                      {diagnostics.providerAvailable ? "可用" : "不可用"}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>认证完整性：</span>
                    <span className={diagnostics.authComplete ? "text-emerald-600" : "text-red-600"}>
                      {diagnostics.authComplete ? "完整" : "不完整"}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>安全检查：</span>
                    <span className={diagnostics.fixSuggestion === "Endpoint is ready to enable." ? "text-emerald-600" : "text-red-600"}>
                      {diagnostics.fixSuggestion === "Endpoint is ready to enable." ? "通过" : "未通过"}
                    </span>
                  </li>
                  {diagnostics.recentError && <li className="text-xs text-amber-700">最近错误：{diagnostics.recentError}</li>}
                  {diagnostics.fixSuggestion !== "Endpoint is ready to enable." && (
                    <li className="rounded border border-red-100 bg-red-50 p-2 text-xs text-red-600">
                      <strong>修复建议：</strong> {diagnostics.fixSuggestion}
                    </li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      </SectionCard>
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
  return "公网入口操作失败。"
}

function getEndpointStatusTone(status: PublicEndpoint["status"]) {
  if (status === "active") return "success"
  if (status === "error") return "danger"
  return "neutral"
}

function formatAuthModeLabel(authMode: PublicEndpoint["authMode"]): string {
  return {
    "opencode-password": "OpenCode 密码",
    "basic-auth": "Basic Auth",
    both: "双重保护",
  }[authMode]
}

function formatTargetTypeLabel(targetType: PublicEndpoint["targetType"]): string {
  return {
    "server-local": "服务器本机",
    "desktop-frp": "桌面 FRP",
    cloudflare: "Cloudflare 隧道",
  }[targetType]
}

function EndpointSecurityModal({ endpoint, safety, onClose, onConfirm }: { endpoint: PublicEndpoint; safety: EndpointSafetyCheck; onClose: () => void; onConfirm: () => Promise<void> }) {
  const checks = [
    { id: "tool", label: "OpenCode 运行中", passed: safety.ok || !safety.issues.some((issue) => issue.toLowerCase().includes("tool")) },
    { id: "password", label: "密码已设置", passed: endpoint.authMode === "opencode-password" || endpoint.authMode === "both" },
    { id: "port", label: "端口可达", passed: safety.ok || !safety.issues.some((issue) => issue.toLowerCase().includes("port")) },
  ]
  const allPassed = safety.ok && checks.every((check) => check.passed)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          <div className="rounded-full bg-blue-50 p-2 text-blue-600">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-800">启用入口安全检查</h2>
            <p className="text-sm text-slate-500">正在检查 {endpoint.name} 的安全配置</p>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <ul className="space-y-3">
            {checks.map((check) => (
              <li key={check.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                <span className="text-sm font-medium text-slate-700">{check.label}</span>
                {check.passed ? <Check className="h-5 w-5 text-emerald-500" /> : <X className="h-5 w-5 text-red-500" />}
              </li>
            ))}
          </ul>
          <div className={`rounded-lg border p-3 text-sm ${safety.ok ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700"}`}>
            {safety.ok ? (
              <span className="flex items-center"><ShieldCheck className="mr-2 h-4 w-4" /> 所有安全检查已通过，可以启用该公网入口。</span>
            ) : (
              <span className="flex items-start"><ShieldAlert className="mr-2 mt-0.5 h-4 w-4 shrink-0" /> 存在未通过的安全检查：{safety.issues.join(" ") || safety.suggestion}</span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-800">
            取消
          </button>
          <button
            type="button"
            disabled={!allPassed}
            onClick={() => void onConfirm()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            确认启用
          </button>
        </div>
      </div>
    </div>
  )
}
