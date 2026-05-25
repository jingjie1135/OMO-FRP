import React from "react"

type ActionTone = "primary" | "secondary" | "danger" | "success" | "slate"
type StatusTone = "success" | "neutral" | "info" | "warning" | "danger"

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </div>
  )
}

export function SectionCard({ title, description, action, children, className = "" }: { title?: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>
      {title || description || action ? (
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-800">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className="p-6">{children}</div>
    </section>
  )
}

export function ActionButton({ tone = "secondary", disabled, onClick, type = "button", children, className = "", title, testId }: { tone?: ActionTone; disabled?: boolean; onClick?: () => void; type?: "button" | "submit"; children: React.ReactNode; className?: string; title?: string; testId?: string }) {
  const toneClass = {
    primary: "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50",
    secondary: "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
    danger: "rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50",
    success: "rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50",
    slate: "rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50",
  }[tone]

  return (
    <button type={type} title={title} data-testid={testId} onClick={onClick} disabled={disabled} className={`${toneClass} ${className}`.trim()}>
      {children}
    </button>
  )
}

export function StatusBadge({ tone = "neutral", children }: { tone?: StatusTone; children: React.ReactNode }) {
  const toneClass = {
    success: "bg-emerald-100 text-emerald-700",
    neutral: "bg-slate-100 text-slate-600",
    info: "bg-blue-100 text-blue-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
  }[tone]

  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>
}

type FieldControlProps = {
  className?: string
  id?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

export function FormField({ label, help, error, children }: { label: string; help?: string; error?: string; children: React.ReactElement<FieldControlProps> }) {
  const fieldId = children.props.id ?? label.toLowerCase().replace(/\s+/g, "-")
  const helpId = help ? `${fieldId}-help` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined
  const control = React.cloneElement(children, {
    id: fieldId,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy,
    className: `w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${children.props.className ?? ""}`.trim(),
  })

  return (
    <label className="block space-y-2 text-sm font-medium text-slate-700" htmlFor={fieldId}>
      <span>{label}</span>
      {control}
      {help ? <span id={helpId} className="block text-xs text-slate-500">{help}</span> : null}
      {error ? <span id={errorId} className="block text-xs text-red-600">{error}</span> : null}
    </label>
  )
}

export function EmptyState({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      {icon ? <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">{icon}</div> : null}
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  )
}

export function FactCard({ label, value, mono = false, tone = "neutral" }: { label: string; value: React.ReactNode; mono?: boolean; tone?: StatusTone }) {
  const toneClass = {
    success: "border-emerald-100 bg-emerald-50/40",
    neutral: "border-slate-200 bg-slate-50",
    info: "border-blue-100 bg-blue-50/40",
    warning: "border-amber-100 bg-amber-50/50",
    danger: "border-red-100 bg-red-50/50",
  }[tone]

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 break-all text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  )
}
