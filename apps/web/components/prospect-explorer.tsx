"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, MapPin, Sparkles, Upload } from "lucide-react";
import { LocaleSelector } from "@/components/locale-selector";
import { getMessages, type Locale } from "@/lib/i18n";
import type { ProspectListResult, ProspectSummary } from "@neora/db";
import type { SectorScoreContract } from "@neora/contracts";

type Props = {
  initialList: ProspectListResult;
  initialSummary: ProspectSummary;
  scores?: SectorScoreContract[];
  initialSector?: string;
  locale: Locale;
  canImport: boolean;
};
type Filter = { sector: string; outreachStatus: string; priority: string; page: number };

export function ProspectExplorer({ initialList, initialSummary, scores = [], initialSector = "", locale, canImport }: Props) {
  const t = getMessages(locale);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const [list, setList] = useState(initialList);
  const [summary, setSummary] = useState(initialSummary);
  const [filter, setFilter] = useState<Filter>({ sector: initialSector, outreachStatus: "", priority: "", page: 1 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sectorScoresMap = useMemo(() => {
    const map = new Map<string, SectorScoreContract>();
    for (const s of scores) {
      map.set(s.sector.toLowerCase(), s);
      map.set(s.sectorCode.toLowerCase(), s);
    }
    return map;
  }, [scores]);

  const activeSectorScore = filter.sector ? sectorScoresMap.get(filter.sector.toLowerCase()) : null;

  const options = useMemo(() => {
    const sectorsSet = new Set(summary.bySector.map((item) => item.key));
    if (initialSector) sectorsSet.add(initialSector);
    for (const s of scores) sectorsSet.add(s.sector);
    return {
      sectors: Array.from(sectorsSet).sort((a, b) => a.localeCompare(b)),
      statuses: summary.byStatus.map((item) => item.key),
    };
  }, [summary, initialSector, scores]);

  const refresh = async (next: Filter) => {
    setBusy(true);
    const params = new URLSearchParams({ page: String(next.page), pageSize: String(list.pageSize) });
    if (next.sector) params.set("sector", next.sector);
    if (next.outreachStatus) params.set("outreachStatus", next.outreachStatus);
    if (next.priority) params.set("priority", next.priority);
    try {
      const response = await fetch(`/api/prospects?${params}`);
      if (!response.ok) throw new Error();
      const body = await response.json();
      setList({ data: body.data, total: body.total, page: body.page, pageSize: body.pageSize });
      setSummary(body.summary);
    } finally {
      setBusy(false);
    }
  };

  const setNextFilter = (patch: Partial<Filter>) => {
    const next = { ...filter, ...patch, page: patch.page ?? 1 };
    setFilter(next);
    void refresh(next);
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/prospects", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(body.data.duplicate ? t.duplicateProspectImport : `${t.importedProspects}: ${body.data.importedCount}`);
      await refresh({ ...filter, page: 1 });
    } catch {
      setMessage(t.invalidProspectCsv);
    } finally {
      setBusy(false);
    }
  };

  const update = async (id: string, priority: "A" | "B" | "C", outreachStatus: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priority, outreachStatus }),
      });
      if (!response.ok) throw new Error();
      setMessage(t.saved);
      await refresh(filter);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-[var(--neora-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-bold text-[var(--neora-primary)]">← {t.back}</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--neora-primary)]">{t.intelligence}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{t.prospectList}</h1>
          <p className="mt-2 text-sm text-[var(--neora-muted)]">{t.prospectSubtitle}</p>
        </div>
        <LocaleSelector locale={locale} />
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label={t.totalProspects} value={summary.total} icon={<Building2 className="size-5" />} />
          <Kpi label={t.bogotaOnly} value={summary.bogotaCount} icon={<MapPin className="size-5" />} />
          <CoverageMap count={summary.bogotaCount} title={t.coverageMap} help={t.coverageMapHelp} />
        </div>
        <section className="rounded-[24px] border border-[var(--neora-border)] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold">{t.byStatus}</h2>
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.byStatus}>
                <CartesianGrid stroke="#e7efec" vertical={false} />
                <XAxis dataKey="key" tick={{ fontSize: 10 }} interval={0} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#087e6b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[24px] border border-[var(--neora-border)] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold">{t.filters}</h2>
          <div className="mt-4 space-y-3">
            <FilterSelect label={t.sector} value={filter.sector} options={options.sectors} all={t.all} onChange={(sector) => setNextFilter({ sector })} />
            <FilterSelect label={t.outreachStatus} value={filter.outreachStatus} options={options.statuses} all={t.all} onChange={(outreachStatus) => setNextFilter({ outreachStatus })} />
            <FilterSelect label={t.priority} value={filter.priority} options={["A", "B", "C"]} all={t.all} onChange={(priority) => setNextFilter({ priority })} />
            <button onClick={() => setNextFilter({ sector: "", outreachStatus: "", priority: "" })} className="text-sm font-bold text-[var(--neora-primary)]">{t.clearFilters}</button>
          </div>
          {canImport && (
            <div className="mt-7 border-t border-[var(--neora-border)] pt-5">
              <h2 className="text-sm font-extrabold">{t.importProspects}</h2>
              <p className="mt-2 text-xs leading-relaxed text-[var(--neora-muted)]">{t.importProspectsHelp}</p>
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--neora-primary)] px-3 py-2.5 text-sm font-bold text-white">
                <Upload className="size-4" />{busy ? t.importing : t.chooseProspectFile}
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void importFile(event.target.files?.[0] ?? null)} />
              </label>
            </div>
          )}
          {message && <p role="status" className="mt-4 text-xs font-semibold text-[var(--neora-tertiary)]">{message}</p>}
        </aside>

        <section className="min-w-0 rounded-[24px] border border-[var(--neora-border)] bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold">{t.prospects}</h2>
              <p className="mt-1 text-sm text-[var(--neora-muted)]">{list.total}</p>
            </div>
            <div className="h-28 w-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.bySector} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="key" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3fd0b4" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {activeSectorScore && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe9e5] bg-[#edf7f3] p-4 text-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <Sparkles className="size-4 text-[#087e6b]" />
                <span className="font-extrabold text-[#182623]">{activeSectorScore.sector} ({activeSectorScore.sectorCode})</span>
                <span className="rounded-full bg-[#087e6b] px-2.5 py-0.5 font-bold text-white">
                  {t.opportunity}: {activeSectorScore.score === null ? "—" : number.format(activeSectorScore.score)} {t.outOf100}
                </span>
                <span className="text-[#697c76]">
                  {t.confidence}: {activeSectorScore.confidence === null ? "—" : `${number.format(activeSectorScore.confidence)}%`}
                </span>
              </div>
              <Link href="/" className="font-bold text-[#087e6b] hover:underline">
                {t.viewInMarketExplorer} →
              </Link>
            </div>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-y border-[var(--neora-border)] bg-[#f5f9f7] text-xs text-[var(--neora-tertiary)]">
                <tr>
                  <th className="p-3">{t.company}</th>
                  <th>{t.sector}</th>
                  <th>{t.fitSignal}</th>
                  <th>{t.priority}</th>
                  <th>{t.outreachStatus}</th>
                  <th>{t.decisionMakerRole}</th>
                  <th>{t.publicSource}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((item) => (
                  <ProspectRow
                    key={item.id}
                    item={item}
                    sectorScore={sectorScoresMap.get(item.sector.toLowerCase())}
                    t={t}
                    disabled={busy}
                    onSave={update}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {list.data.length === 0 && <p className="py-10 text-center text-sm text-[var(--neora-muted)]">{t.noProspects}</p>}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button disabled={busy || list.page <= 1} onClick={() => setNextFilter({ page: list.page - 1 })} className="rounded-lg border border-[var(--neora-border)] px-3 py-2 text-sm disabled:opacity-40">{t.previous}</button>
            <span className="text-xs text-[var(--neora-muted)]">{list.page}</span>
            <button disabled={busy || list.page * list.pageSize >= list.total} onClick={() => setNextFilter({ page: list.page + 1 })} className="rounded-lg border border-[var(--neora-border)] px-3 py-2 text-sm disabled:opacity-40">{t.next}</button>
          </div>
        </section>
      </section>
    </main>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <article className="rounded-[24px] border border-[var(--neora-border)] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between text-sm font-bold text-[var(--neora-tertiary)]">
        <span>{label}</span>
        <span className="grid size-9 place-items-center rounded-xl bg-[var(--neora-accent)] text-[var(--neora-primary)]">{icon}</span>
      </div>
      <p className="mt-5 text-3xl font-extrabold">{value}</p>
    </article>
  );
}

function CoverageMap({ count, title, help }: { count: number; title: string; help: string }) {
  return (
    <article className="relative overflow-hidden rounded-[24px] border border-[var(--neora-border)] bg-[#e7f7f2] p-5">
      <p className="text-sm font-bold text-[var(--neora-tertiary)]">{title}</p>
      <svg viewBox="0 0 100 120" className="absolute bottom-1 right-3 h-28 opacity-25" aria-hidden="true">
        <path d="M49 4 72 23 69 44 83 61 68 83 67 111 47 117 32 94 20 75 29 51 25 31Z" fill="#087e6b" />
      </svg>
      <div className="relative mt-3 flex items-center gap-2 text-sm font-extrabold text-[var(--neora-primary)]">
        <MapPin className="size-5" /> Bogotá · {count}
      </div>
      <p className="relative mt-3 text-xs leading-relaxed text-[var(--neora-muted)]">{help}</p>
    </article>
  );
}

function FilterSelect({ label, value, options, all, onChange }: { label: string; value: string; options: string[]; all: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-bold text-[var(--neora-tertiary)]">
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--neora-border)] bg-[#f8fbfa] p-2.5 text-sm text-[var(--neora-neutral)]">
        <option value="">{all}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ProspectRow({
  item,
  sectorScore,
  t,
  disabled,
  onSave,
}: {
  item: ProspectListResult["data"][number];
  sectorScore?: SectorScoreContract | undefined;
  t: ReturnType<typeof getMessages>;
  disabled: boolean;
  onSave: (id: string, priority: "A" | "B" | "C", outreachStatus: string) => Promise<void>;
}) {
  const [priority, setPriority] = useState(item.priority);
  const [status, setStatus] = useState(item.outreachStatus);
  return (
    <tr className="border-b border-[var(--neora-border)] align-top last:border-0">
      <td className="p-3 font-bold">
        <p>{item.companyName}</p>
        <p className="mt-1 max-w-48 text-xs font-normal text-[var(--neora-muted)]">{item.initialProposal}</p>
      </td>
      <td className="p-3">
        <p className="font-semibold text-[#182623]">{item.sector}</p>
        {sectorScore && sectorScore.score !== null && (
          <span
            className="mt-1 inline-flex items-center gap-1 rounded-md bg-[#e7f7f2] px-1.5 py-0.5 text-[10px] font-bold text-[#087e6b]"
            title={`${t.opportunity}: ${sectorScore.score.toFixed(1)} ${t.outOf100}`}
          >
            {sectorScore.score.toFixed(1)} {t.points}
          </span>
        )}
      </td>
      <td className="max-w-56 p-3 text-xs text-[var(--neora-muted)]">{item.fitSignal}</td>
      <td>
        <select
          aria-label={`${t.priority} ${item.companyName}`}
          value={priority}
          onChange={(event) => setPriority(event.target.value as "A" | "B" | "C")}
          className="rounded-lg border border-[var(--neora-border)] p-2"
        >
          <option>A</option>
          <option>B</option>
          <option>C</option>
        </select>
      </td>
      <td>
        <input
          aria-label={`${t.outreachStatus} ${item.companyName}`}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-32 rounded-lg border border-[var(--neora-border)] p-2"
        />
        <button
          disabled={disabled}
          onClick={() => void onSave(item.id, priority, status)}
          className="ml-2 text-xs font-bold text-[var(--neora-primary)]"
        >
          {t.saved}
        </button>
      </td>
      <td className="p-3">{item.decisionMakerRole}</td>
      <td className="p-3">
        <a
          href={item.publicUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-bold text-[var(--neora-primary)] hover:underline"
        >
          {t.openSource}
        </a>
      </td>
    </tr>
  );
}
