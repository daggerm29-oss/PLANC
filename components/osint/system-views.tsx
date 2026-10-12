"use client"

import { useState } from "react"
import useSWR from "swr"

import { Button } from "@/components/ui/button"
import { apiPost, type EntitySummary, fetcher } from "@/lib/api"

import { Badge, EntityChip, Panel, StateMessage } from "./bits"
import { CrawlerPanel } from "./intel-view"
import { McaUploadPanel } from "./mca-upload-panel"

type Stats = {
  counts: Record<string, number>
  sources: { id: string; name: string; homepage: string | null; licence: string; entities: number }[]
  runs: { id: number; source_id: string; started_at: string; finished_at: string | null; status: string; error: string | null }[]
  pending_reviews: number
}

type AiStatusFull = {
  provider: { provider: string; model: string; available: boolean; reason?: string }
  limits: Record<string, number>
  today: { requests: number; ok: number; rate_limited: number; failed: number; total_tokens: number; remaining_requests: number }
  window: { requests_last_60s: number; next_slot_in_seconds: number }
  cooldown: { active: boolean; remaining_seconds: number }
  cache: { entries: number; hits: number; misses: number; hit_rate: number | null }
  recent_requests: { id: number; status: string; task: string; attempt: number; http_status: number | null; latency_ms: number | null }[]
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-background/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg">{value}</p>
    </div>
  )
}

export function SystemView() {
  const stats = useSWR<Stats>("/api/stats", fetcher, { refreshInterval: 15000 })
  const ai = useSWR<AiStatusFull>("/api/ai/status", fetcher, { refreshInterval: 10000 })
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Data store">
        {!stats.data ? <StateMessage error={stats.error} loading={stats.isLoading} /> : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {Object.entries(stats.data.counts).map(([k, v]) => <Stat key={k} label={k.replace(/_/g, " ")} value={v.toLocaleString()} />)}
              <Stat label="pending reviews" value={stats.data.pending_reviews} />
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">Source</th><th className="pb-2 font-medium">Licence</th><th className="pb-2 text-right font-medium">Entities</th></tr></thead>
              <tbody>{stats.data.sources.map((s) => (
                <tr key={s.id} className="border-t border-border/60">
                  <td className="py-1.5">{s.homepage ? <a className="hover:underline" href={s.homepage} target="_blank" rel="noreferrer">{s.name}</a> : s.name}</td>
                  <td className="py-1.5 text-muted-foreground">{s.licence}</td>
                  <td className="py-1.5 text-right font-mono">{s.entities}</td>
                </tr>
              ))}</tbody>
            </table>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Ingestion runs</h3>
              {stats.data.runs.length === 0 ? <StateMessage empty="No ingest runs yet. Use the CLI (see NEXT_STEPS.md)." /> : (
                <ul className="flex flex-col gap-1 text-sm">{stats.data.runs.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-2"><Badge>{`#${r.id}`}</Badge><Badge>{r.source_id}</Badge>
                    <Badge tone={r.status === "success" ? "documented" : r.status === "failed" ? "reported" : undefined}>{r.status}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{r.started_at}</span>{r.error && <span className="text-destructive">{r.error}</span>}</li>
                ))}</ul>
              )}
            </div>
          </div>
        )}
      </Panel>
        <McaUploadPanel />
        <CrawlerPanel />
        <Panel title="AI request budget">
        {!ai.data ? <StateMessage error={ai.error} loading={ai.isLoading} /> : (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Provider <span className="font-mono">{ai.data.provider.provider}</span> · model <span className="font-mono">{ai.data.provider.model}</span> ·{" "}
              {ai.data.provider.available ? <Badge tone="documented">available</Badge> : <Badge tone="reported">unavailable</Badge>}
              {ai.data.provider.reason && <span className="ml-2 text-muted-foreground">{ai.data.provider.reason}</span>}
            </p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="RPM limit" value={ai.data.limits.rpm_limit} />
              <Stat label="last 60s" value={ai.data.window.requests_last_60s} />
              <Stat label="next slot (s)" value={ai.data.window.next_slot_in_seconds} />
              <Stat label="today used / left" value={`${ai.data.today.requests} / ${ai.data.today.remaining_requests}`} />
              <Stat label="429s today" value={ai.data.today.rate_limited} />
              <Stat label="cooldown (s)" value={ai.data.cooldown.active ? ai.data.cooldown.remaining_seconds : "none"} />
              <Stat label="cache hit rate" value={ai.data.cache.hit_rate ?? "—"} />
              <Stat label="tokens today" value={ai.data.today.total_tokens} />
            </div>
            {ai.data.recent_requests.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs">{ai.data.recent_requests.map((r) => (
                <li key={r.id} className="flex gap-2 font-mono"><span>#{r.id}</span><span>{r.task}</span><span>{r.status}</span><span>{r.http_status ?? ""}</span><span>{r.latency_ms ? `${r.latency_ms}ms` : ""}</span></li>
              ))}</ul>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}

type Investigation = { id: number; title: string; notes: string | null; updated_at: string; item_count?: number
  items?: { id: number; item_type: string; ref: string; note: string | null; entity: EntitySummary | null }[] }

export function InvestigationsView({ onOpen }: { onOpen: (id: string) => void }) {
  const list = useSWR<{ items: Investigation[] }>("/api/investigations", fetcher)
  const [selected, setSelected] = useState<number | null>(null)
  const detail = useSWR<Investigation>(selected ? `/api/investigations/${selected}` : null, fetcher)
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")

  const create = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!title.trim()) return
    const inv = await apiPost<Investigation>("/api/investigations", { title })
    setTitle(""); setSelected(inv.id); list.mutate()
  }
  const addNote = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!selected || !note.trim()) return
    await apiPost(`/api/investigations/${selected}/items`, { item_type: "note", ref: "note", note })
    setNote(""); detail.mutate(); list.mutate()
  }
  const remove = async (itemId: number) => {
    await fetch(`/api/investigations/${selected}/items/${itemId}`, { method: "DELETE" })
    detail.mutate(); list.mutate()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Saved investigations">
        <form onSubmit={create} className="mb-3 flex gap-2">
          <label htmlFor="inv-title" className="sr-only">New investigation title</label>
          <input id="inv-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New investigation" maxLength={200}
            className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <Button size="sm" type="submit">Create</Button>
        </form>
        {!list.data ? <StateMessage error={list.error} loading={list.isLoading} /> : (
          <ul className="flex flex-col gap-1">{list.data.items.map((i) => (
            <li key={i.id}><button type="button" onClick={() => setSelected(i.id)}
              className={`w-full rounded px-2 py-1.5 text-left text-sm ${selected === i.id ? "bg-accent" : "hover:bg-accent/60"}`}>
              {i.title} <span className="text-xs text-muted-foreground">({i.item_count})</span></button></li>
          ))}</ul>
        )}
      </Panel>
      <Panel title={detail.data?.title ?? "Investigation"} className="lg:col-span-2">
        {!selected ? <StateMessage empty="Select or create an investigation. Use “Add to investigation” on any entity page." /> :
          !detail.data ? <StateMessage error={detail.error} loading={detail.isLoading} /> : (
            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-2">{detail.data.items?.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-2 rounded border border-border/60 p-2 text-sm">
                  <div className="flex flex-col gap-1"><Badge>{it.item_type}</Badge>
                    {it.entity ? <EntityChip entity={it.entity} onOpen={onOpen} /> : it.item_type !== "note" && <span className="font-mono">{it.ref}</span>}
                    {it.note && <p className="text-muted-foreground">{it.note}</p>}</div>
                  <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>Remove</Button>
                </li>
              ))}</ul>
              <form onSubmit={addNote} className="flex gap-2">
                <label htmlFor="inv-note" className="sr-only">Add note</label>
                <input id="inv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an analyst note" maxLength={2000}
                  className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm" />
                <Button size="sm" type="submit">Add note</Button>
              </form>
            </div>
          )}
      </Panel>
    </div>
  )
}

export async function addEntityToLatestInvestigation(entityId: string): Promise<string> {
  const list = await fetcher<{ items: Investigation[] }>("/api/investigations")
  const target = list.items[0] ?? (await apiPost<Investigation>("/api/investigations", { title: "Untitled investigation" }))
  await apiPost(`/api/investigations/${target.id}/items`, { item_type: "entity", ref: entityId })
  return target.title
}
