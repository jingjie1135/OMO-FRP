import { useState, type ChangeEvent, type FormEvent } from "react"
import type { PublicEndpoint, RuntimeInfo } from "../../../core/app-config/types"
import { isEndpointTypeAvailable, isValidEndpointAddress, normalizeEndpointAddress, validateEndpoint } from "../../../core/endpoints/endpoint-service"
import { ActionButton, FormField } from "../../components/FomoPrimitives"

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
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <FormField label="入口名称" help="用于在管理台中识别该公网入口。" error={errors.name}>
        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </FormField>

      <FormField label="公网域名" help="可以粘贴完整 URL，保存时会自动规范化为域名和协议。" error={errors.domain}>
        <input
          name="domain"
          value={formData.domain}
          onChange={handleChange}
          required
        />
      </FormField>

      <FormField label="访问协议">
        <select
          name="protocol"
          value={formData.protocol}
          onChange={handleChange}
        >
          <option value="https">HTTPS</option>
          <option value="http">HTTP</option>
          <option value="tcp">TCP</option>
        </select>
      </FormField>

      <FormField label="目标类型" error={errors.targetType}>
        <select
          name="targetType"
          value={formData.targetType}
          onChange={handleChange}
        >
          <option value="server-local">服务器本机（Caddy）</option>
          <option value="desktop-frp">桌面 FRP</option>
          <option value="cloudflare">Cloudflare 隧道</option>
        </select>
      </FormField>

      <FormField label="目标工具实例" error={errors.targetToolInstanceId}>
        <select
          name="targetToolInstanceId"
          value={formData.targetToolInstanceId}
          onChange={handleChange}
          required
        >
          <option value="">选择工具实例...</option>
          {runtimeInfo.config.toolInstances.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.displayName} ({tool.id})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="认证方式" error={errors.authMode}>
        <select
          name="authMode"
          value={formData.authMode}
          onChange={handleChange}
        >
          <option value="opencode-password">OpenCode 密码</option>
          <option value="basic-auth">Basic Auth</option>
          <option value="both">双重保护</option>
        </select>
      </FormField>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <ActionButton onClick={onCancel} tone="secondary">取消</ActionButton>
        <ActionButton type="submit" tone="primary">保存</ActionButton>
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
