import React from "react"
import type { ManagementClient } from "../../management-api/client"
import type { ConfigDocument, ConfigTarget } from "../../management-api/types"
import { CloudflareTunnelPageWrapper } from "../features/cloudflare/CloudflareTunnelPageWrapper"
import { createDefaultCloudflareTunnelConfig } from "../features/cloudflare/use-cloudflare-tunnel-state"
import { ConfigPage } from "../features/config/ConfigPage"
import { DashboardPage } from "../features/dashboard/DashboardPage"
import { DesktopTunnelsPageWrapper } from "../features/desktop-tunnels/DesktopTunnelsPageWrapper"
import { EndpointsPageWrapper } from "../features/endpoints/EndpointsPageWrapper"
import { FrpPageWrapper } from "../features/frp/FrpPageWrapper"
import { SettingsPage } from "../features/settings/SettingsPage"
import { createFallbackBackupSummary, createFallbackSecurityChecks } from "../features/settings/use-settings-state"
import { ToolsPage } from "../features/tools/ToolsPage"

const OPENCODE_TARGET: ConfigTarget = {
  toolInstanceId: "opencode-server",
  kind: "opencode",
}

const OH_MY_OPENAGENT_TARGET: ConfigTarget = {
  toolInstanceId: "opencode-server",
  kind: "oh-my-openagent",
}

export async function loadDashboardPage(client: ManagementClient): Promise<React.ReactNode> {
  const info = await client.getRuntimeInfo()
  return React.createElement(DashboardPage, { info })
}

export async function loadToolsPage(client: ManagementClient): Promise<React.ReactNode> {
  return React.createElement(ToolsPage, { client })
}

export async function loadConfigPage(client: ManagementClient): Promise<React.ReactNode> {
  const info = await client.getRuntimeInfo()
  const tool = info.config.toolInstances[0]
  const opencodePath = tool?.configDirectory ? `${tool.configDirectory}/opencode.json` : undefined
  const pluginPath = info.config.pluginConfigs.find((item) => item.toolInstanceId === tool?.id)?.configPath ?? (tool?.configDirectory ? `${tool.configDirectory}/oh-my-openagent.json` : undefined)
  if (!tool) {
    return React.createElement(ConfigPage, {
      client,
      presets: [],
      backups: [],
      opencode: {
        target: OPENCODE_TARGET,
        content: "",
        missing: true,
        error: "No tool instance is available.",
      },
      ohMyOpenAgent: {
        target: OH_MY_OPENAGENT_TARGET,
        content: "",
        missing: true,
        error: "No tool instance is available.",
      },
    })
  }

  const opencodeTarget: ConfigTarget = { ...OPENCODE_TARGET, toolInstanceId: tool.id, path: opencodePath }
  const pluginTarget: ConfigTarget = { ...OH_MY_OPENAGENT_TARGET, toolInstanceId: tool.id, path: pluginPath }

  const [opencode, ohMyOpenAgent] = await Promise.all([
    safeReadConfig(client, opencodeTarget),
    safeReadConfig(client, pluginTarget),
  ])

  const initialTarget = ohMyOpenAgent.missing ? opencodeTarget : pluginTarget
  const [presets, backups] = await Promise.all([
    client.listPresets(initialTarget),
    client.listBackups(initialTarget),
  ])

  return React.createElement(ConfigPage, {
    client,
    initialSelectedTarget: initialTarget,
    opencode,
    ohMyOpenAgent,
    presets,
    backups,
  })
}

export async function loadEndpointsPage(client: ManagementClient): Promise<React.ReactNode> {
  return React.createElement(EndpointsPageWrapper, { client })
}

export async function loadDesktopTunnelsPage(client: ManagementClient): Promise<React.ReactNode> {
  const initialDevices = await client.listDesktopTunnelDevices()
  return React.createElement(DesktopTunnelsPageWrapper, { client, initialDevices })
}

export async function loadFrpPage(client: ManagementClient): Promise<React.ReactNode> {
  const [initialRuntimeInfo, initialStatus, initialEndpoints] = await Promise.all([
    client.getRuntimeInfo(),
    client.getFrpStatus(),
    client.listEndpoints(),
  ])
  return React.createElement(FrpPageWrapper, { client, initialRuntimeInfo, initialStatus, initialEndpoints })
}

export async function loadCloudflareTunnelPage(client: ManagementClient): Promise<React.ReactNode> {
  const [initialRuntimeInfo, initialStatus] = await Promise.all([
    client.getRuntimeInfo(),
    client.getCloudflareTunnelStatus(),
  ])
  const initialConfig = createDefaultCloudflareTunnelConfig(initialRuntimeInfo, initialRuntimeInfo.config.publicEndpoints.find((endpoint) => endpoint.targetType === "cloudflare"))
  const initialPlan = await client.createCloudflareTunnelPlan(initialConfig)
  return React.createElement(CloudflareTunnelPageWrapper, { client, initialRuntimeInfo, initialStatus, initialPlan, initialConfig })
}

export async function loadSettingsPage(client: ManagementClient): Promise<React.ReactNode> {
  const runtimeInfo = await client.getRuntimeInfo()
  const [securityChecks, backupSummary] = await Promise.all([
    client.getSecurityChecks?.() ?? Promise.resolve(createFallbackSecurityChecks(runtimeInfo)),
    client.getBackupSummary?.() ?? Promise.resolve(createFallbackBackupSummary(runtimeInfo)),
  ])
  return React.createElement(SettingsPage, { client, initialData: { runtimeInfo, securityChecks, backupSummary } })
}


async function safeReadConfig(client: ManagementClient, target: ConfigTarget): Promise<ConfigDocument> {
  try {
    return await client.readConfig(target)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const lowerMessage = message.toLowerCase()
    return {
      target,
      content: "",
      path: target.path,
      missing: lowerMessage.includes("missing") || lowerMessage.includes("not found") || lowerMessage.includes("no such file"),
      error: message,
    }
  }
}
