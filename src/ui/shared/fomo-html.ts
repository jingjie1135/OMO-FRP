export function escapeHtml(value: string | number | undefined): string {
  if (value === undefined) return ""
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function pageFrame(input: { title: string; subtitle: string; actions?: string; body: string; maxWidth?: string }): string {
  return `<section class="fomo-page ${input.maxWidth ?? "max-w-7xl"} mx-auto p-8 space-y-8 animate-in fade-in duration-300">
  <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h2 class="text-2xl font-semibold text-slate-800 tracking-tight">${escapeHtml(input.title)}</h2>
      <p class="text-sm text-slate-500 mt-1">${escapeHtml(input.subtitle)}</p>
    </div>
    ${input.actions ?? ""}
  </header>
  ${input.body}
</section>`
}

export function panel(title: string, body: string, extraClass = ""): string {
  return `<section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${extraClass}">
  <div class="px-6 py-4 border-b border-slate-200 bg-slate-50">
    <h3 class="font-medium text-slate-800">${escapeHtml(title)}</h3>
  </div>
  <div class="p-6">${body}</div>
</section>`
}

export function pill(label: string, tone: "blue" | "emerald" | "amber" | "red" | "slate" = "slate"): string {
  const toneClass = {
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  }[tone]
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${toneClass}">${escapeHtml(label)}</span>`
}

export function monoBlock(body: string): string {
  return `<pre class="m-0 whitespace-pre-wrap rounded-lg bg-slate-900 p-5 font-mono text-sm leading-relaxed text-slate-200">${escapeHtml(body)}</pre>`
}
