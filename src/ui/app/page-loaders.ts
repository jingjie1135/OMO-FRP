import type { ManagementClient } from "../../management-api/client"
import type { ConfigTarget } from "../../management-api/types"
import { ConfigPage } from "../features/config/ConfigPage"
import { DashboardPage } from "../features/dashboard/DashboardPage"
import { EndpointsPage } from "../features/endpoints/EndpointsPage"
import { FrpPage } from "../features/frp/FrpPage"
import { SettingsPage } from "../features/settings/SettingsPage"
import { ToolsPage } from "../features/tools/ToolsPage"

const OPENCODE_TARGET: ConfigTarget = {
  toolInstanceId: "opencode-server",
  kind: "opencode",
}

const OH_MY_OPENAGENT_TARGET: ConfigTarget = {
  toolInstanceId: "opencode-server",
  kind: "oh-my-openagent",
}

export async function loadDashboardPage(client: ManagementClient): Promise<string> {
  const info = await client.getRuntimeInfo()
  return DashboardPage(info)
}

export async function loadToolsPage(client: ManagementClient): Promise<string> {
  const [tools, detections] = await Promise.all([client.listToolInstances(), client.detectTools()])
  return ToolsPage({ tools, detections })
}

export async function loadConfigPage(client: ManagementClient): Promise<string> {
  const info = await client.getRuntimeInfo()
  const tool = info.config.toolInstances[0]
  if (!tool) {
    return ConfigPage({ presets: [], backups: [], error: "No tool instance is available." })
  }

  const opencodeTarget: ConfigTarget = { ...OPENCODE_TARGET, toolInstanceId: tool.id }
  const pluginTarget: ConfigTarget = { ...OH_MY_OPENAGENT_TARGET, toolInstanceId: tool.id }

  const [opencode, ohMyOpenAgent, presets, backups] = await Promise.all([
    safeReadConfig(client, opencodeTarget),
    safeReadConfig(client, pluginTarget),
    client.listPresets(pluginTarget),
    client.listBackups(pluginTarget),
  ])

  return ConfigPage({
    opencode: opencode ?? undefined,
    ohMyOpenAgent: ohMyOpenAgent ?? undefined,
    presets,
    backups,
  })
}

export async function loadEndpointsPage(client: ManagementClient): Promise<string> {
  const endpoints = await client.listEndpoints()
  return EndpointsPage({ endpoints })
}

export async function loadFrpPage(client: ManagementClient): Promise<string> {
  const [info, status, endpoints] = await Promise.all([client.getRuntimeInfo(), client.getFrpStatus(), client.listEndpoints()])
  return FrpPage({ capabilities: info.capabilities, status, endpoints })
}

export async function loadSettingsPage(client: ManagementClient): Promise<string> {
  const info = await client.getRuntimeInfo()
  return SettingsPage(info)
}

async function safeReadConfig(client: ManagementClient, target: ConfigTarget) {
  try {
    return await client.readConfig(target)
  } catch {
    return null
  }
}
