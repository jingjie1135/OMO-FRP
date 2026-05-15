import React from "react"
import type { RuntimeInfo } from "../../../management-api/types"
import { DashboardView } from "./DashboardView"

export interface DashboardPageProps {
  info: RuntimeInfo
}

export function DashboardPage({ info }: DashboardPageProps) {
  return <DashboardView runtimeInfo={info} frpStatus={{ mode: info.capabilities.mode === "server" ? "server" : "client", running: false, message: "Initializing..." }} logs={[]} />
}
