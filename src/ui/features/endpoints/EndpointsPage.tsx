import type { PublicEndpoint } from "../../../core/app-config/types"
import { escapeHtml, pageFrame, pill } from "../../shared/fomo-html"

const requiredChecks = ["OpenCode 密码", "Caddy Basic Auth", "FRP token", "域名 allowlist", "TLS/反代状态", "目标端口冲突"]

export function EndpointsPage(endpoints: PublicEndpoint[]): string {
  const rows = endpoints.map(endpointRow).join("\n")
  const body = `<section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead><tr class="bg-slate-50 border-b border-slate-200">
          <th class="px-6 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase">入口名称</th>
          <th class="px-6 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase">公网 URL</th>
          <th class="px-6 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase">目标工具</th>
          <th class="px-6 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase">认证方式</th>
          <th class="px-6 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase">安全状态</th>
          <th class="px-6 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase text-right">状态</th>
        </tr></thead>
        <tbody class="divide-y divide-slate-100">${rows}</tbody>
      </table>
    </div>
  </section>
  ${securityModal(endpoints[0])}`

  return pageFrame({ title: "公网入口", subtitle: "管理暴露到公网的服务端口与代理规则", body })
}

function endpointRow(endpoint: PublicEndpoint): string {
  const active = endpoint.status === "active"
  const warning = endpoint.authMode !== "both" || endpoint.status !== "active"
  return `<tr class="hover:bg-slate-50/50 transition-colors">
    <td class="px-6 py-4"><span class="text-sm font-medium text-slate-800">${escapeHtml(endpoint.name)}</span></td>
    <td class="px-6 py-4"><span class="text-sm text-slate-600 font-mono">${escapeHtml(endpoint.domain)}</span></td>
    <td class="px-6 py-4"><span class="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs text-slate-600 font-mono">${escapeHtml(endpoint.targetToolInstanceId)}</span></td>
    <td class="px-6 py-4"><span class="text-sm text-slate-600">${escapeHtml(authLabel(endpoint.authMode))}</span></td>
    <td class="px-6 py-4">${warning ? pill("警告", "amber") : pill("安全", "emerald")}</td>
    <td class="px-6 py-4 text-right"><button class="relative inline-flex h-6 w-11 rounded-full ${active ? "bg-blue-600" : "bg-slate-200"}"><span class="sr-only">Toggle endpoint</span><span class="inline-block h-5 w-5 rounded-full bg-white shadow transform ${active ? "translate-x-5" : "translate-x-0"}"></span></button><span class="ml-3 text-xs font-medium text-slate-500 min-w-[3rem] inline-block text-left">${active ? "已启用" : "未启用"}</span></td>
  </tr>`
}

function securityModal(endpoint: PublicEndpoint | undefined): string {
  const name = endpoint?.name ?? "OpenCode Web"
  return `<aside class="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
    <div class="px-6 py-5 border-b border-slate-100 flex items-center space-x-3">
      <div class="p-2 bg-blue-50 text-blue-600 rounded-full">◇</div>
      <div><h3 class="text-lg font-semibold text-slate-800 tracking-tight">启用入口安全检查</h3><p class="text-sm text-slate-500">正在检查 ${escapeHtml(name)} 的安全配置</p><p class="mt-1 text-xs font-mono text-blue-600">enableEndpoint / disableEndpoint</p></div>
    </div>
    <div class="p-6 space-y-3">
      ${requiredChecks.map((label) => checkRow(label, label === "OpenCode 密码" ? "fail" : "pass")).join("")}
      <div class="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">存在未通过的安全检查，为了您的数据安全，无法启用该公网入口。请先修复相关配置。</div>
    </div>
    <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3"><button class="px-4 py-2 text-sm font-medium text-slate-600">取消</button><button class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">确认启用</button></div>
  </aside>`
}

function checkRow(label: string, status: "pass" | "fail"): string {
  return `<div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100"><span class="text-sm font-medium text-slate-700">${escapeHtml(label)}</span><span class="${status === "pass" ? "text-emerald-500" : "text-red-500"}">${status === "pass" ? "✓" : "×"}</span></div>`
}

function authLabel(authMode: PublicEndpoint["authMode"]): string {
  if (authMode === "both") return "Password + Basic Auth"
  if (authMode === "basic-auth") return "Basic Auth"
  return "Password"
}
