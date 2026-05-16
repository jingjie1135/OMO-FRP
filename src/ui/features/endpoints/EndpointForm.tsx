import { useState, type ChangeEvent, type FormEvent } from "react"
import type { PublicEndpoint, RuntimeInfo } from "../../../core/app-config/types"
import { isEndpointTypeAvailable, isValidEndpointAddress, normalizeEndpointAddress, validateEndpoint } from "../../../core/endpoints/endpoint-service"

export interface EndpointFormProps {
  endpoint?: Partial<PublicEndpoint>
  runtimeInfo: RuntimeInfo
  onSave: (endpoint: PublicEndpoint) => void
  onCancel: () => void
}

export function EndpointForm({ endpoint, runtimeInfo, onSave, onCancel }: EndpointFormProps) {
  const [formData, setFormData] = useState<PublicEndpoint>({
    id: endpoint?.id || createEndpointId(),
    name: endpoint?.name || "",
    domain: endpoint?.domain || "",
    protocol: endpoint?.protocol || "https",
    targetType: endpoint?.targetType || "server-local",
    targetToolInstanceId: endpoint?.targetToolInstanceId || runtimeInfo.config.toolInstances[0]?.id || "",
    authMode: endpoint?.authMode || "opencode-password",
    status: endpoint?.status ?? "disabled",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    const newErrors = validateEndpointForm(formData, runtimeInfo)

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSave(normalizeEndpointAddress(formData))
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 p-4 border rounded shadow-sm bg-white">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="w-full border rounded p-1"
          required
        />
        {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Domain / Public Host</label>
        <input
          name="domain"
          value={formData.domain}
          onChange={handleChange}
          className="w-full border rounded p-1"
          required
        />
        {errors.domain && <p className="text-red-500 text-xs">{errors.domain}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Protocol</label>
        <select
          name="protocol"
          value={formData.protocol}
          onChange={handleChange}
          className="w-full border rounded p-1"
        >
          <option value="https">HTTPS</option>
          <option value="http">HTTP</option>
          <option value="tcp">TCP</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Target Type</label>
        <select
          name="targetType"
          value={formData.targetType}
          onChange={handleChange}
          className="w-full border rounded p-1"
        >
          <option value="server-local">Server Local (Caddy)</option>
          <option value="desktop-frp">Desktop FRP</option>
          <option value="cloudflare">Cloudflare Tunnel</option>
        </select>
        {errors.targetType && <p className="text-red-500 text-xs">{errors.targetType}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Target Tool Instance</label>
        <select
          name="targetToolInstanceId"
          value={formData.targetToolInstanceId}
          onChange={handleChange}
          className="w-full border rounded p-1"
          required
        >
          <option value="">Select a tool...</option>
          {runtimeInfo.config.toolInstances.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.displayName} ({tool.id})
            </option>
          ))}
        </select>
        {errors.targetToolInstanceId && <p className="text-red-500 text-xs">{errors.targetToolInstanceId}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Auth Mode</label>
        <select
          name="authMode"
          value={formData.authMode}
          onChange={handleChange}
          className="w-full border rounded p-1"
        >
          <option value="opencode-password">OpenCode Password</option>
          <option value="basic-auth">Basic Auth</option>
          <option value="both">Both</option>
        </select>
        {errors.authMode && <p className="text-red-500 text-xs">{errors.authMode}</p>}
      </div>

      <div className="flex justify-end space-x-2">
        <button type="button" onClick={onCancel} className="px-3 py-1 border rounded">
          Cancel
        </button>
        <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">
          Save
        </button>
      </div>
    </form>
  )
}

export function validateEndpointForm(endpoint: PublicEndpoint, runtimeInfo: RuntimeInfo): Record<string, string> {
  const newErrors: Record<string, string> = {}
  const normalizedEndpoint = normalizeEndpointAddress(endpoint)
  const validation = validateEndpoint({ ...normalizedEndpoint, status: "active" })

  for (const issue of validation.issues) {
    newErrors[issue.path] = issue.message
  }

  if (!normalizedEndpoint.name.trim()) {
    newErrors.name = "Endpoint name is required"
  }

  if (!isValidEndpointAddress(normalizedEndpoint)) {
    newErrors.domain = "Invalid domain format"
  }

  const targetTool = runtimeInfo.config.toolInstances.find((tool) => tool.id === normalizedEndpoint.targetToolInstanceId)
  if (!targetTool) {
    newErrors.targetToolInstanceId = "Target tool instance is required"
  }

  if (normalizedEndpoint.targetType === "server-local" && runtimeInfo.capabilities.mode !== "server") {
    newErrors.targetType = "Server-local endpoints require server runtime mode"
  }

  if (normalizedEndpoint.targetType === "desktop-frp" && !isEndpointTypeAvailable("desktop-frp", { capabilities: runtimeInfo.capabilities, toolInstances: runtimeInfo.config.toolInstances })) {
    newErrors.targetType = "Desktop FRP endpoints require FRP client capability"
  }

  if (normalizedEndpoint.targetType === "cloudflare" && !isEndpointTypeAvailable("cloudflare", { capabilities: runtimeInfo.capabilities, toolInstances: runtimeInfo.config.toolInstances })) {
    newErrors.targetType = "Cloudflare endpoints require cloudflared"
  }

  return newErrors
}

function createEndpointId(): string {
  return `endpoint-${Date.now().toString(36)}`
}
