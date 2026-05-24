import { monoBlock, pageFrame, panel } from "../../shared/fomo-html"

export function CloudflarePage(): string {
  const quickCommand = "cloudflared tunnel --url http://127.0.0.1:4096"
  const namedCommands = [
    "cloudflared tunnel login",
    "cloudflared tunnel create 'local-opencode'",
    "cloudflared tunnel route dns 'local-opencode' 'opencode.example.com'",
    "cloudflared tunnel run 'local-opencode'",
  ].join("\n")

  const body = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    ${panel("快速隧道", `<p class="text-sm text-slate-500 mb-4">用于本机 OpenCode 临时公开访问，适合快速验证。</p>${monoBlock(quickCommand)}`)}
    ${panel("命名隧道", `<p class="text-sm text-slate-500 mb-4">用于绑定 Cloudflare 托管域名和长期公网入口。</p>${monoBlock(namedCommands)}`)}
  </div>
  ${panel("规划诊断", `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"><div class="rounded-lg bg-amber-50 p-3 text-amber-800">password-missing / hostname-missing / cloudflared-missing</div><div class="rounded-lg bg-slate-50 p-3 text-slate-700">canExpose · dependencies · diagnostics · securityNotes</div><div class="rounded-lg bg-slate-50 p-3 text-slate-700">Windows configure command</div><div class="rounded-lg bg-slate-50 p-3 text-slate-700">successChecks</div></div>`)}
  ${panel("启用前检查", `<ul class="space-y-3 text-sm text-slate-700"><li>✓ OPENCODE_SERVER_PASSWORD 已配置</li><li>✓ cloudflared 已安装</li><li>✓ 本地端口 4096 可达</li><li>✓ 域名属于当前 Cloudflare 账户</li></ul>`)} `
  return pageFrame({ title: "Cloudflare 隧道", subtitle: "生成本机 OpenCode 的 Cloudflare Tunnel 引导命令", body })
}
