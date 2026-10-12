"use client"

import { Activity, Briefcase, FileSearch, GitCompareArrows, ListChecks, Radar, Search } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"

import { LeadsView, PathsView, RelationshipInspector, ReviewView } from "./analysis-views"
import { StateMessage } from "./bits"
import { EntityView } from "./entity-view"
import { IntelView } from "./intel-view"
import { SearchBox } from "./search-box"
import { addEntityToLatestInvestigation, InvestigationsView, SystemView } from "./system-views"

const VIEWS = [
  { id: "intel", label: "Intelligence", icon: FileSearch },
  { id: "entity", label: "Entity explorer", icon: Search },
  { id: "paths", label: "Connection paths", icon: GitCompareArrows },
  { id: "leads", label: "Leads", icon: Radar },
  { id: "review", label: "Match review", icon: ListChecks },
  { id: "investigations", label: "Investigations", icon: Briefcase },
  { id: "system", label: "Sources & AI budget", icon: Activity },
] as const
type View = (typeof VIEWS)[number]["id"]

export function Workspace() {
  const [view, setView] = useState<View>("intel")
  const [entityId, setEntityId] = useState<string | null>(null)
  const [relId, setRelId] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const open = (id: string) => { setEntityId(id); setView("entity"); setRelId(null) }
  const save = async (id: string) => {
    try { setToast(`Added to “${await addEntityToLatestInvestigation(id)}”`) } catch (e) { setToast((e as Error).message) }
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-border bg-sidebar p-4 md:w-72 md:border-b-0 md:border-r">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">PLANB</p>
          <p className="text-sm font-semibold">Financial intelligence workspace</p>
        </div>
        <SearchBox onPick={(e) => open(e.id)} />
        <nav aria-label="Workspace" className="flex flex-row flex-wrap gap-1 md:flex-col">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" onClick={() => setView(v.id)} aria-current={view === v.id ? "page" : undefined}
              className={cn("flex items-center gap-2 rounded px-2.5 py-1.5 text-sm",
                view === v.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
              <v.icon className="size-4" aria-hidden />{v.label}
            </button>
          ))}
        </nav>
        <p className="mt-auto hidden text-xs leading-relaxed text-muted-foreground md:block">
          Relationships, shared attributes and name matches are leads for review, not proof of wrongdoing.
        </p>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-6">
        {view === "entity" && (entityId
          ? <EntityView key={entityId} entityId={entityId} onOpen={open} onEdge={setRelId} onSave={save} />
          : <StateMessage empty="Search for a company, person, LEI or IMO number in the sidebar to open its profile." />)}
        {view === "intel" && <IntelView onOpen={open} />}
        {view === "paths" && <PathsView onOpen={open} onEdge={setRelId} />}
        {view === "leads" && <LeadsView onOpen={open} />}
        {view === "review" && <ReviewView onOpen={open} />}
        {view === "investigations" && <InvestigationsView onOpen={open} />}
        {view === "system" && <SystemView />}
      </main>

      {relId !== null && <RelationshipInspector relId={relId} onOpen={open} onClose={() => setRelId(null)} />}
      {toast && <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded border border-border bg-card px-4 py-2 text-sm shadow-lg">{toast}</div>}
    </div>
  )
}
