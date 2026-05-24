import type { RuntimeCapabilities } from "../../../core/app-config/types"
import { pageFrame, panel } from "../../shared/fomo-html"
import { ClientFrpPanel } from "./ClientFrpPanel"
import { getFrpPanelActions } from "./frp-panel-actions"
import { ServerFrpPanel } from "./ServerFrpPanel"

export type FrpPanelKind = "server" | "client" | "unavailable"

export function selectFrpPanelKind(capabilities: Pick<RuntimeCapabilities, "mode" | "canManageFrpServer" | "canManageFrpClient">): FrpPanelKind {
  if (capabilities.mode === "server" && capabilities.canManageFrpServer) return "server"
  if (capabilities.mode === "desktop" && capabilities.canManageFrpClient) return "client"
  return "unavailable"
}

export function FrpPage(capabilities: RuntimeCapabilities): string {
  const panelKind = selectFrpPanelKind(capabilities)
  if (panelKind === "server") return serverPage()
  if (panelKind === "client") return clientPage()
  return pageFrame({ title: "FRP 穿透", subtitle: "当前运行时不可管理 FRP", body: panel("不可用", "当前运行时没有 FRP 管理能力。") })
}

function serverPage(): string {
  const actions = getFrpPanelActions("server")
  const body = `${statusCard("FRP 服务端", "运行中", "https://frp.example.com", "emerald")}
  ${panel("服务端操作", `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">${actions.map(actionButton).join("")}</div><div class="mt-4 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-500">${ServerFrpPanel()} · saveFrpConfig · startFrp · stopFrp</div>`)}
  ${panel("客户端列表", `<div class="space-y-3 text-sm"><div class="flex items-center justify-between rounded-lg border border-slate-100 p-3"><span>alice-desktop</span><span class="text-emerald-600">已连接</span></div><div class="flex items-center justify-between rounded-lg border border-slate-100 p-3"><span>server-opencode</span><span class="text-slate-500">等待连接</span></div></div>`)}
  ${panel("连接配置", `<dl class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm"><div><dt class="text-slate-500">服务器地址</dt><dd class="font-mono text-slate-800">frp.example.com</dd></div><div><dt class="text-slate-500">绑定端口</dt><dd class="font-mono text-slate-800">7000</dd></div><div><dt class="text-slate-500">面板地址</dt><dd class="font-mono text-blue-600">https://frp.example.com</dd></div><div><dt class="text-slate-500">认证密钥</dt><dd class="font-mono text-slate-800">••••••••••••</dd></div></dl>`)} `
  return pageFrame({ title: "FRP 穿透", subtitle: "配置服务器 FRP 服务端并生成桌面端连接配置", body, maxWidth: "max-w-4xl" })
}

function clientPage(): string {
  const actions = getFrpPanelActions("desktop")
  const body = `${statusCard("FRP 客户端", "已连接", "https://dev.example.com", "emerald")}
  ${panel("客户端操作", `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">${actions.map(actionButton).join("")}</div><div class="mt-4 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-500">${ClientFrpPanel()} · saveFrpConfig · startFrp · stopFrp</div>`)}
  ${panel("连接配置", `<div class="grid grid-cols-1 md:grid-cols-2 gap-6"><label class="space-y-2 text-sm font-medium text-slate-700">服务器地址<input value="frp.example.com" class="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" /></label><label class="space-y-2 text-sm font-medium text-slate-700">服务器端口<input value="7000" class="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" /></label><label class="space-y-2 text-sm font-medium text-slate-700">本地目标端口<input value="8080" class="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" /></label><label class="space-y-2 text-sm font-medium text-slate-700">认证密钥<input type="password" placeholder="example_token_replace_me" class="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" /></label></div><div class="pt-6 flex justify-end"><button class="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium">保存配置</button></div>`)} `
  return pageFrame({ title: "FRP 穿透", subtitle: "配置内网穿透以便从公网访问本地服务", body, maxWidth: "max-w-4xl" })
}

function statusCard(title: string, status: string, url: string, tone: "emerald" | "slate"): string {
  return `<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"><div class="flex items-center space-x-6"><div class="w-16 h-16 rounded-full flex items-center justify-center ${tone === "emerald" ? "bg-emerald-50 text-emerald-500" : "bg-slate-50 text-slate-400"}">◇</div><div><div class="flex items-center space-x-3 mb-1"><span class="text-sm font-semibold text-slate-800 uppercase tracking-wider">${title}</span><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">${status}</span></div><p class="text-slate-600 font-mono text-sm mt-2"><a class="text-blue-600 hover:underline">${url}</a></p></div></div><button class="px-6 py-3 rounded-lg font-medium bg-red-50 text-red-600 border border-red-200">断开连接</button></section>`
}

function actionButton(action: string): string {
  return `<button class="px-4 py-3 rounded-lg border border-slate-200 bg-white text-left text-sm font-medium text-slate-700 hover:border-blue-500 hover:bg-blue-50 transition-colors">${action}</button>`
}
