import { describe, expect, it } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ActionButton, EmptyState, FormField, PageHeader, SectionCard, StatusBadge } from "./FomoPrimitives"

describe("FOMO UI primitives", () => {
  it("renders the shared page and card grammar used by management tabs", () => {
    const html = renderToStaticMarkup(
      <section>
        <PageHeader eyebrow="公网地址、路由与验收" title="公网入口" action={<ActionButton tone="primary">新建入口</ActionButton>} />
        <SectionCard title="入口列表" description="统一使用 slate 卡片与标题栏。">
          <StatusBadge tone="success">已启用</StatusBadge>
        </SectionCard>
      </section>,
    )

    expect(html).toContain("text-sm font-medium text-slate-500")
    expect(html).toContain("text-2xl font-semibold tracking-tight text-slate-900")
    expect(html).toContain("rounded-xl border border-slate-200 bg-white shadow-sm")
    expect(html).toContain("border-b border-slate-200 bg-slate-50 px-6 py-4")
    expect(html).toContain("rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm")
    expect(html).toContain("rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700")
  })

  it("renders form fields, empty states, and secondary/destructive actions with FOMO styling", () => {
    const html = renderToStaticMarkup(
      <SectionCard title="配置">
        <FormField label="入口名称" help="用于在管理台中识别该入口。" error="入口名称不能为空。">
          <input name="name" />
        </FormField>
        <EmptyState title="还没有公网入口" description="新建入口后会在这里显示公网地址和安全状态。" />
        <ActionButton tone="secondary">取消</ActionButton>
        <ActionButton tone="danger">停用</ActionButton>
      </SectionCard>,
    )

    expect(html).toContain("text-sm font-medium text-slate-700")
    expect(html).toContain("w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm")
    expect(html).toContain("focus:border-blue-500 focus:ring-2 focus:ring-blue-500")
    expect(html).toContain("text-xs text-slate-500")
    expect(html).toContain("text-xs text-red-600")
    expect(html).toContain("rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm")
    expect(html).toContain("rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm")
    expect(html).toContain("rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700")
  })
})
