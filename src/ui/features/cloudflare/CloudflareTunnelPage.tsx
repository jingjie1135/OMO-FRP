import React, { useEffect, useMemo, useState } from "react"
import type {
  CloudflareTunnelConfigRequest,
  CloudflareTunnelPlan,
  CloudflareTunnelStatus,
  CloudflareTunnelStepId,
} from "../../../management-api/types"
import type { RuntimeInfo } from "../../../core/app-config/types"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { getCloudflareFailureGuidance, redactCloudflareTunnelText, validateCloudflareTunnelConfig } from "./use-cloudflare-tunnel-state"

export interface CloudflareTunnelPageProps {
  runtimeInfo?: RuntimeInfo
  status: CloudflareTunnelStatus
  config: CloudflareTunnelConfigRequest
  plan?: CloudflareTunnelPlan
  loading?: boolean
  error?: string
  saveConfig?: (config: CloudflareTunnelConfigRequest) => Promise<void>
  startTunnel?: () => Promise<void>
  stopTunnel?: () => Promise<void>
  retryStep?: (stepId: CloudflareTunnelStepId) => Promise<void>
  getActionStatus?: (key: string) => "idle" | "pending" | "succeeded" | "failed"
  getActionError?: (key: string) => { message: string; retryable?: boolean; needsReauth?: boolean; status?: number; target?: string } | undefined
}

export function CloudflareTunnelPage(props: CloudflareTunnelPageProps) {
  const [draft, setDraft] = useState<CloudflareTunnelConfigRequest>(props.config)

  useEffect(() => {
    setDraft(props.config)
  }, [props.config])

  const validation = useMemo(() => validateCloudflareTunnelConfig(draft), [draft])
  const planMode = props.plan?.mode ?? draft.mode
  const actionStatus = props.getActionStatus ?? (() => "idle" as const)
  const actionError = props.getActionError ?? (() => undefined)
  const cloudflaredDetected = props.plan?.cloudflaredDetected ?? Boolean(props.runtimeInfo?.config.toolInstances.some((tool) => tool.kind === "cloudflared" && tool.installState !== "missing"))
  const publicUrl = props.plan?.publicUrl ?? props.status.publicUrl ?? (draft.mode === "named" && draft.hostname ? `https://${draft.hostname}` : "https://<generated>.trycloudflare.com")

  if (props.loading) {
    return <div className="p-4 text-gray-500">Loading Cloudflare Tunnel state...</div>
  }

  if (props.error) {
    return <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">Cloudflare Tunnel Error: {props.error}</div>
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Cloudflare Tunnel Management</h1>
      <section aria-label="Cloudflare Tunnel status" className="space-y-3">
        <p className="font-mono text-sm">cloudflare:{planMode}</p>
        <p className="font-mono text-sm">cloudflared:{cloudflaredDetected ? "detected" : "missing"}</p>
        <p>Status: {props.status.running ? "running" : "stopped"}</p>
        <p>{props.status.message}</p>
        {props.status.failureReason && (
          <p role="alert">Guidance: {props.status.suggestion ?? getCloudflareFailureGuidance(props.status.failureReason)}</p>
        )}
      </section>

      <form
        aria-label="Cloudflare tunnel configuration form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void props.saveConfig?.(draft)
        }}
      >
        <h2 id="cloudflare-config-heading" className="text-lg font-semibold">Tunnel Configuration</h2>
        <label>
          Mode
          <select name="mode" value={draft.mode} onChange={(event) => {
            const value = event.currentTarget.value === "named" ? "named" : "quick"
            setDraft((current) => ({ ...current, mode: value }))
          }}>
            <option value="quick">Quick tunnel</option>
            <option value="named">Named tunnel</option>
          </select>
        </label>
        <label>
          Local host
          <input name="localHost" value={draft.localHost} onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({ ...current, localHost: value }))
          }} />
        </label>
        <label>
          Local port
          <input name="localPort" type="number" value={draft.localPort} onChange={(event) => {
            const value = Number(event.currentTarget.value)
            setDraft((current) => ({ ...current, localPort: value }))
          }} />
        </label>
        <label>
          Hostname
          <input name="hostname" value={draft.hostname ?? ""} onChange={(event) => {
            const value = event.currentTarget.value || undefined
            setDraft((current) => ({ ...current, hostname: value }))
          }} />
        </label>
        <label>
          Tunnel name
          <input name="tunnelName" value={draft.tunnelName ?? ""} onChange={(event) => {
            const value = event.currentTarget.value || undefined
            setDraft((current) => ({ ...current, tunnelName: value }))
          }} />
        </label>
        <label>
          DNS route
          <input name="dnsRoute" value={draft.dnsRoute ?? ""} onChange={(event) => {
            const value = event.currentTarget.value || undefined
            setDraft((current) => ({ ...current, dnsRoute: value }))
          }} />
        </label>
        {!validation.ok && (
          <ul role="alert">
            {validation.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        )}
        <button type="submit" disabled={!validation.ok || actionStatus("cloudflare:save-config") === "pending"}>Save tunnel draft</button>
        <AsyncActionStatus status={actionStatus("cloudflare:save-config")} />
        {actionError("cloudflare:save-config") && <p role="alert">{actionError("cloudflare:save-config")?.message}</p>}
      </form>

      {planMode === "quick" ? <QuickTunnelFlow plan={props.plan} publicUrl={publicUrl} localUrl={props.plan?.localUrl ?? `http://${draft.localHost}:${draft.localPort}`} /> : <NamedTunnelFlow plan={props.plan} retryStep={props.retryStep} actionStatus={actionStatus} />}

      <section aria-label="Cloudflare Tunnel actions" className="space-y-2">
        <h2 className="text-lg font-semibold">Tunnel Actions</h2>
        <button type="button" onClick={() => void props.startTunnel?.()} disabled={actionStatus("cloudflare:start") === "pending"}>Start tunnel</button>
        <button type="button" onClick={() => void props.stopTunnel?.()} disabled={actionStatus("cloudflare:stop") === "pending"}>Stop tunnel</button>
        <AsyncActionStatus status={actionStatus("cloudflare:start")} />
        <AsyncActionStatus status={actionStatus("cloudflare:stop")} />
      </section>
    </div>
  )
}

function QuickTunnelFlow({ plan, publicUrl, localUrl }: { plan?: CloudflareTunnelPlan; publicUrl: string; localUrl: string }) {
  const commands = plan?.commandSummary ?? [`cloudflared tunnel --url ${localUrl}`]
  return (
    <section aria-label="Quick tunnel flow" className="space-y-2">
      <h2 className="text-lg font-semibold">Quick tunnel flow</h2>
      <p>Local target: {localUrl}</p>
      <p>Temporary public URL: {publicUrl}</p>
      <CommandSummary commands={commands} />
      <Notes plan={plan} />
    </section>
  )
}

function NamedTunnelFlow({ plan, retryStep, actionStatus }: { plan?: CloudflareTunnelPlan; retryStep?: (stepId: CloudflareTunnelStepId) => Promise<void>; actionStatus: (key: string) => "idle" | "pending" | "succeeded" | "failed" }) {
  return (
    <section aria-label="Named tunnel flow" className="space-y-3">
      <h2 className="text-lg font-semibold">Named tunnel flow</h2>
      <p>Hostname: {plan?.hostname ?? "not configured"}</p>
      <p>Tunnel name: {plan?.tunnelName ?? "not configured"}</p>
      <p>DNS route: {plan?.dnsRoute ?? plan?.hostname ?? "not configured"}</p>
      <p>Public URL: {plan?.publicUrl ?? "not available"}</p>
      <CommandSummary commands={plan?.commandSummary ?? []} />
      <ol>
        {(plan?.steps ?? []).map((step) => (
          <li key={step.id}>
            <strong>{step.label}</strong>: {step.status}
            {step.message ? ` — ${redactCloudflareTunnelText(step.message)}` : ""}
            {step.status === "failed" && step.retryable && (
              <button type="button" data-testid={`retry-cloudflare-step-${step.id}`} onClick={() => void retryStep?.(step.id)} disabled={actionStatus(`cloudflare:retry:${step.id}`) === "pending"}>
                Retry
              </button>
            )}
          </li>
        ))}
      </ol>
      <Notes plan={plan} />
    </section>
  )
}

function CommandSummary({ commands }: { commands: string[] }) {
  return (
    <section aria-label="Command summary">
      <h3 className="text-md font-medium">Command summary</h3>
      <pre>{commands.map(redactCloudflareTunnelText).join("\n")}</pre>
    </section>
  )
}

function Notes({ plan }: { plan?: CloudflareTunnelPlan }) {
  if (!plan) return null
  return (
    <section aria-label="Cloudflare diagnostics">
      <h3 className="text-md font-medium">Diagnostics and security notes</h3>
      <ul>
        {plan.diagnostics.map((diagnostic) => <li key={diagnostic.code}>{diagnostic.severity}: {redactCloudflareTunnelText(diagnostic.message)} Fix: {redactCloudflareTunnelText(diagnostic.fix)}</li>)}
        {plan.securityNotes.map((note) => <li key={note}>{redactCloudflareTunnelText(note)}</li>)}
      </ul>
    </section>
  )
}
