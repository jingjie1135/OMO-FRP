import React from "react"
import type { RuntimeMode } from "../../core/app-config/types"

export interface LayoutRoute {
  path: string
  label: string
}

export interface AppLayoutProps {
  mode: RuntimeMode
  routes: LayoutRoute[]
  children?: React.ReactNode
}

export function AppLayout({ mode, routes, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <span className="font-bold text-xl">OpenCode Platform ({mode})</span>
          <nav aria-label="主导航" className="space-x-4 flex">
            {routes.map((route) => (
              <a
                key={route.path}
                href={route.path}
                className="hover:underline px-2 py-1 rounded transition-colors hover:bg-blue-700"
              >
                {route.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="container mx-auto flex-grow bg-white shadow-sm mt-4 p-4 rounded-t-lg">
        {children}
        <div className="hidden" data-testid="layout-summary">
          {mode}:{routes.map((route) => route.label).join("|")}
        </div>
      </main>
    </div>
  )
}
