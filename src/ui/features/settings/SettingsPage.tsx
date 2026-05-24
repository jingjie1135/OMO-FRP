import { pageFrame, panel } from "../../shared/fomo-html"

export function SettingsPage(): string {
  const body = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    ${panel("密钥与备份", `<div class="space-y-4 text-sm text-slate-600"><p>SecretRef 只保存引用，真实 token/password 存放在受限环境或系统密钥库。</p><button class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">立即备份当前配置</button></div>`)}
    ${panel("管理员会话", `<dl class="space-y-3 text-sm"><div class="flex justify-between"><dt class="text-slate-500">Session 策略</dt><dd class="font-medium text-slate-800">Bearer token</dd></div><div class="flex justify-between"><dt class="text-slate-500">API 访问</dt><dd class="font-medium text-emerald-600">已保护</dd></div><div class="flex justify-between"><dt class="text-slate-500">日志脱敏</dt><dd class="font-medium text-emerald-600">启用</dd></div></dl>`)}
  </div>`
  return pageFrame({ title: "设置", subtitle: "管理安全边界、管理员会话、密钥引用和备份策略", body })
}
