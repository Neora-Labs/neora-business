"use client";

import { useMemo, useState } from "react";
import { Badge } from "@neora/ui";
import type { SectorScoreContract } from "@neora/contracts";
import type { ImportRunRecord } from "@neora/db";
import { AlertTriangle, ArrowUpRight, Database, Gauge, MapPin, ShieldCheck } from "lucide-react";

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

export function MarketExplorer({ scores, cities, importRuns = [] }: { scores: SectorScoreContract[]; cities: readonly string[]; importRuns?: ImportRunRecord[] }) {
  const [city, setCity] = useState(cities[0]);
  const ranked = useMemo(() => scores.filter((score) => score.city === city).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), [scores, city]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = scores.find((score) => score.id === selectedId) ?? ranked[0];
  if (!selected) return <main className="mx-auto max-w-4xl px-5 py-16"><h1 className="text-4xl font-semibold">Market Explorer</h1><p className="mt-4 text-slate-400">No licensed market scores are available for this account.</p></main>;
  return <div className="min-h-screen">
    <header className="border-b border-white/10 bg-[#07120f]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-emerald-400 font-black text-slate-950">N</div><div><p className="text-sm font-bold">NEORA LABS</p><p className="text-xs text-slate-400">Opportunity Index</p></div></div>
        <Badge>Internal pilot · Colombia</Badge>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-5 py-10">
      <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-emerald-300">Market intelligence</p><h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Market Explorer</h1><p className="mt-3 max-w-2xl text-slate-400">Compare opportunity and evidence confidence without confusing commercial potential with data quality.</p></div>
        <label className="flex min-w-56 flex-col gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">City<select aria-label="City" value={city} onChange={(event) => { setCity(event.target.value); setSelectedId(null); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-medium normal-case tracking-normal text-white">{cities.map((item) => <option className="bg-slate-900" key={item}>{item}</option>)}</select></label>
      </section>
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[.07] p-4 text-sm text-amber-100"><AlertTriangle className="mt-0.5 size-5 shrink-0"/><div><strong>License review pending</strong><p className="mt-1 text-amber-100/70">Synthetic sample only. It cannot be published into actionable lead views or used as official market evidence.</p></div></div>
      {importRuns.length > 0 && <section aria-label="Import status" className="mb-6 rounded-2xl border border-white/10 bg-[#0d1d18] p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Import status</h2><p className="mt-1 text-xs text-slate-400">Executed locally or in GitHub Actions; this application does not start remote jobs.</p></div><Badge tone={importRuns[0]?.status === "completed" ? "success" : "neutral"}>{importRuns[0]?.status}</Badge></div><p className="mt-3 text-xs text-slate-500">Run {importRuns[0]?.id} · {importRuns[0]?.rowsAccepted} accepted · {importRuns[0]?.finishedAt}</p></section>}
      <section className="grid gap-6 lg:grid-cols-[1.45fr_.95fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1d18] shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-white/10 p-5"><div><h2 className="font-semibold">Sector ranking</h2><p className="mt-1 text-xs text-slate-400">Model v{selected.modelVersion} · Period 2025</p></div><Badge tone="success">5 pilot sectors</Badge></div>
          <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">#</th><th className="px-3 py-4">Sector</th><th className="px-3 py-4 text-right">Opportunity</th><th className="px-5 py-4 text-right">Confidence</th></tr></thead><tbody>{ranked.map((score, index) => <tr data-testid="sector-row" key={score.id} onClick={() => setSelectedId(score.id)} className={`border-t border-white/[.06] transition hover:bg-white/[.04] ${selected.id === score.id ? "bg-emerald-400/[.07]" : ""}`}><td className="px-5 py-4 text-sm text-slate-500">{String(index + 1).padStart(2,"0")}</td><td className="px-3 py-4"><button className="text-left font-medium">{score.sector}</button><p className="mt-1 text-xs text-slate-500">{score.status === "scored" ? "Ready for review" : "Insufficient data"}</p></td><td className="px-3 py-4 text-right"><strong className="text-xl text-emerald-300">{score.score === null ? "—" : number.format(score.score)}</strong><span className="text-xs text-slate-500"> / 100</span></td><td className="px-5 py-4 text-right"><span className="font-semibold">{number.format(score.confidence)}</span><p className="text-xs capitalize text-slate-500">{score.confidenceLabel}</p></td></tr>)}</tbody></table></div>
        </div>
        <aside className="rounded-2xl border border-white/10 bg-[#0d1d18] p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-slate-500">Selected sector</p><h2 className="mt-2 text-xl font-semibold">{selected.sector}</h2><p className="mt-2 flex items-center gap-1 text-sm text-slate-400"><MapPin className="size-4" /> {selected.city}, Colombia</p></div><ArrowUpRight className="size-5 text-emerald-300"/></div>
          <div className="my-5 grid grid-cols-2 gap-3"><Metric icon={<Gauge className="size-4"/>} label="Opportunity" value={selected.score}/><Metric icon={<ShieldCheck className="size-4"/>} label="Confidence" value={selected.confidence}/></div>
          <h3 className="mb-3 font-semibold">Factor evidence</h3><div className="space-y-3">{selected.factors.map((factor) => <div key={factor.key}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-300">{factor.label}</span><span className="text-slate-500">{factor.value === null ? "Missing" : `${Math.round(factor.value * 100)}%`} · w{factor.weight}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${(factor.value ?? 0) * 100}%` }}/></div><a href={`#evidence-${factor.evidenceId}`} className="mt-1 block text-[11px] text-emerald-300/80 hover:underline">Evidence {factor.evidenceId}</a></div>)}</div>
          <details open className="mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-semibold">Confidence model v{selected.confidenceModelVersion}</summary><div className="mt-3 space-y-2">{selected.confidenceFactors.map((factor) => <div key={factor.key} className="text-xs text-slate-400"><div className="flex justify-between"><span>{factor.label}</span><span>{factor.value === null ? "Missing" : `${Math.round(factor.value * 100)}%`} · {number.format(factor.contribution ?? 0)} pts</span></div><a href={`#evidence-${factor.evidenceId}`} className="mt-1 block text-[11px] text-emerald-300/80 hover:underline" aria-label={`Confidence evidence ${factor.evidenceId}`}>Evidence {factor.evidenceId}</a></div>)}</div></details>
          <h3 className="mb-3 mt-5 font-semibold">Evidence records</h3><div className="max-h-48 space-y-2 overflow-y-auto">{selected.evidence.map((item) => <article id={`evidence-${item.id}`} key={item.id} className="scroll-mt-4 rounded-lg border border-white/[.07] bg-black/10 p-3"><p className="text-xs font-semibold">{item.title}</p><p className="mt-1 text-[11px] text-slate-500">{item.sourceName} · observed {item.observedAt} · license {item.licenseReviewStatus}</p><a href={item.sourceUri} target="_blank" rel="noreferrer" className="mt-1 block break-all text-[10px] text-emerald-300/70 hover:underline">Open source {item.sourceName}</a></article>)}</div>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/[.04] p-3"><Database className="size-4 text-slate-400"/><div><p className="text-sm font-semibold">{selected.source.name}</p><p className="text-xs text-slate-500">Observed {selected.source.observedAt} · pending review</p></div></div>
        </aside>
      </section>
      <footer className="mt-8 text-center text-xs text-slate-600">Synthetic decision-support preview · Scores are deterministic, versioned, and not production evidence.</footer>
    </main>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | null }) {
  return <div className="rounded-xl border border-white/[.07] bg-white/[.03] p-3"><div className="flex items-center gap-2 text-xs text-slate-400">{icon}{label}</div><p className="mt-2 text-2xl font-semibold">{value === null ? "—" : number.format(value)}<span className="text-xs text-slate-500"> / 100</span></p></div>;
}
