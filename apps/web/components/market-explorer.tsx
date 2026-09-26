"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import { Badge, cn } from "@neora/ui";

const MarketMatrixChart = dynamic(
  () => import("./market-matrix-chart").then((m) => m.MarketMatrixChart),
  {
    ssr: false,
    loading: () => <div className="h-[280px] w-full animate-pulse rounded-xl bg-[#f5f9f7]" />,
  }
);
import { LocaleSelector } from "@/components/locale-selector";
import { getMessages, type Locale } from "@/lib/i18n";
import type { SectorScoreContract } from "@neora/contracts";
import type { ImportRunRecord } from "@neora/db";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Database,
  FileSearch,
  Gauge,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";



type MarketExplorerProps = {
  scores: SectorScoreContract[];
  cities: readonly string[];
  importRuns?: ImportRunRecord[];
  locale: Locale;
};

export function MarketExplorer({ scores, cities, importRuns = [], locale }: MarketExplorerProps) {
  const t = getMessages(locale);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const [city, setCity] = useState(cities[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const ranked = useMemo(
    () => scores.filter((score) => score.city === city).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    [scores, city],
  );
  const filteredRanked = useMemo(() => {
    if (!searchQuery.trim()) return ranked;
    const q = searchQuery.toLowerCase().trim();
    return ranked.filter((s) => s.sector.toLowerCase().includes(q) || s.sectorCode.toLowerCase().includes(q));
  }, [ranked, searchQuery]);
  const selected = scores.find((score) => score.id === selectedId) ?? filteredRanked[0] ?? ranked[0];
  const overview = useMemo(() => summarize(ranked), [ranked]);
  const latestImport = importRuns[0];

  const matrixData = useMemo(() => {
    return ranked
      .filter((s) => s.score !== null)
      .map((s) => {
        const opp = s.score ?? 0;
        const conf = s.confidence ?? 0;
        let quadrant = 4;
        let color = "#94a3b8";
        if (opp >= 65 && conf >= 60) {
          quadrant = 1;
          color = "#087e6b";
        } else if (opp >= 65 && conf < 60) {
          quadrant = 2;
          color = "#d97706";
        } else if (opp < 65 && conf >= 60) {
          quadrant = 3;
          color = "#64748b";
        }
        return {
          id: s.id,
          name: s.sector,
          code: s.sectorCode,
          opportunity: opp,
          confidence: conf,
          quadrant,
          color,
        };
      });
  }, [ranked]);

  if (!selected) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        <h1 className="text-4xl font-bold">{t.marketExplorer}</h1>
        <p className="mt-4 text-[#697c76]">{t.noScores}</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[92px_minmax(0,1fr)]">
      <Navigation locale={locale} />

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#dfe9e5] bg-white/95 px-4 py-4 shadow-[0_1px_12px_rgba(24,38,35,0.04)] backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#087e6b]">{t.intelligence}</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#182623]">{t.marketExplorer}</h1>
              <p className="mt-1 text-sm text-[#697c76]">{t.subtitle}</p>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-bold text-[#4b635c] sm:min-w-52 sm:flex-none">
                {t.city}
                <span className="relative">
                  <MapPin aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#087e6b]" />
                  <select
                    aria-label={t.city}
                    value={city}
                    onChange={(event) => {
                      setCity(event.target.value);
                      setSelectedId(null);
                    }}
                    className="w-full appearance-none rounded-xl border border-[#d6e3df] bg-[#f5f9f7] py-2.5 pl-9 pr-8 text-sm font-semibold text-[#182623] transition hover:border-[#3fd0b4] focus:border-[#087e6b]"
                  >
                    {cities.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </span>
              </label>
              <LocaleSelector locale={locale} /><Badge tone="success">{t.pilot}</Badge>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <section id="overview" aria-label={t.marketOverview} className="scroll-mt-32">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                emphasized
                icon={<Sparkles className="size-5" />}
                label={t.topOpportunity}
                value={overview.topScore === null ? "—" : number.format(overview.topScore)}
                unit={t.outOf100}
                detail={overview.topSector ?? t.noScoredSectors}
              />
              <KpiCard
                icon={<BarChart3 className="size-5" />}
                label={t.averageOpportunity}
                value={overview.averageScore === null ? "—" : number.format(overview.averageScore)}
                unit={t.outOf100}
                detail={t.acrossScored}
              />
              <KpiCard
                icon={<ShieldCheck className="size-5" />}
                label={t.evidenceConfidence}
                value={overview.averageConfidence === null ? "—" : number.format(overview.averageConfidence)}
                unit={t.outOf100}
                detail={t.separate}
              />
              <KpiCard
                icon={<Building2 className="size-5" />}
                label={t.evaluatedSectors}
                value={String(overview.scoredCount)}
                detail={`${overview.insufficientCount} ${t.insufficientData}`}
              />
            </div>
          </section>

          <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1.35fr_.65fr]">
            <div className="flex items-start gap-3 rounded-2xl border border-[#f1d49d] bg-[#fff8e9] p-4 text-sm text-[#6f5122]">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#b9770e]" />
              <div>
                <strong className="font-extrabold text-[#5c4017]">{t.licensePending}</strong>
                <p className="mt-1 leading-relaxed text-[#7c6238]">{t.syntheticWarning}</p>
              </div>
            </div>
            <section aria-label={t.importStatus} className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe9e5] bg-white p-4 shadow-[0_8px_30px_rgba(24,38,35,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e7f7f2] text-[#087e6b]"><Database className="size-5" /></span>
                  <div><h2 className="text-sm font-extrabold">{t.importStatus}</h2><p className="mt-0.5 text-xs text-[#697c76]">{latestImport ? `${latestImport.rowsAccepted} ${t.rowsAccepted}` : t.noRecentRun}</p></div>
                </div>
                {latestImport && <Badge tone={latestImport.status === "completed" ? "success" : "neutral"}>{latestImport.status}</Badge>}
              </div>
              {latestImport && <p className="mt-3 truncate text-[11px] text-[#82918c]" title={latestImport.id}>{t.run} {latestImport.id} · {latestImport.finishedAt}</p>}
            </section>
          </section>

          <section className="rounded-2xl border border-[#dfe9e5] bg-[#edf7f3] p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#087e6b]"><Gauge className="size-5" /></span>
              <div><h2 className="text-sm font-extrabold">{t.signals}</h2><p className="mt-1 text-xs leading-relaxed text-[#5d706a]">{t.signalsDetail}</p></div>
            </div>
            <p className="mt-3 shrink-0 text-xs font-bold text-[#087e6b] sm:mt-0">{t.model} v{selected.modelVersion} · {t.period} {selected.period}</p>
          </section>

          <section id="matrix" aria-label={t.matrixTitle} className="scroll-mt-32 rounded-[24px] border border-[#dfe9e5] bg-white p-5 shadow-[0_12px_40px_rgba(24,38,35,0.05)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#e6efec] pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087e6b]">{t.researchPriority}</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">{t.matrixTitle}</h2>
                <p className="mt-1 text-xs text-[#697c76]">{t.matrixHelp}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#087e6b]" /> Q1: {t.quadrant1}</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#d97706]" /> Q2: {t.quadrant2}</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#64748b]" /> Q3: {t.quadrant3}</span>
              </div>
            </div>
            <div className="mt-4 w-full" style={{ minHeight: 280 }}>
              <MarketMatrixChart
                matrixData={matrixData}
                selectedId={selected.id}
                onSelectId={setSelectedId}
                t={t}
                number={number}
              />
            </div>
          </section>

          <section className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
            <div id="ranking" className="scroll-mt-32 overflow-hidden rounded-[24px] border border-[#dfe9e5] bg-white shadow-[0_12px_40px_rgba(24,38,35,0.05)]">
              <div className="flex flex-col gap-3 border-b border-[#e6efec] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087e6b]">{t.researchPriority}</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">{t.sectorRanking}</h2>
                  <p className="mt-1 text-xs text-[#697c76]">{t.selectSector}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-[#d6e3df] bg-[#f8fbfa] px-3 py-1.5 text-xs focus-within:border-[#087e6b]">
                    <Search className="size-4 text-[#82918c]" />
                    <input
                      type="text"
                      placeholder={t.searchSector}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-40 sm:w-48 bg-transparent outline-none placeholder:text-[#9aa9a4]"
                    />
                  </div>
                  <span className="hidden rounded-xl bg-[#e7f7f2] px-3 py-2 text-xs font-bold text-[#087e6b] sm:inline-flex">{filteredRanked.length} {t.sectors}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead className="bg-[#f9fbfa] text-[11px] font-bold uppercase tracking-[0.13em] text-[#82918c]"><tr><th className="px-5 py-4 sm:px-6">#</th><th className="px-3 py-4">{t.sector}</th><th className="px-3 py-4 text-right">{t.opportunity}</th><th className="px-5 py-4 text-right sm:px-6">{t.confidence}</th></tr></thead>
                  <tbody>
                    {filteredRanked.map((score, index) => {
                      const active = selected.id === score.id;
                      return (
                        <tr data-testid="sector-row" key={score.id} className={cn("border-t border-[#edf2f0] transition", active ? "bg-[#edf8f4]" : "hover:bg-[#f8fbfa]") }>
                          <td className="px-5 py-4 align-middle text-sm font-bold text-[#9aa9a4] sm:px-6">{String(index + 1).padStart(2, "0")}</td>
                          <td className="px-3 py-4">
                            <button aria-pressed={active} onClick={() => setSelectedId(score.id)} className="group block w-full text-left">
                              <span className="font-bold text-[#253632] transition group-hover:text-[#087e6b]">{score.sector}</span>
                              <span className="mt-1 flex items-center gap-2 text-xs text-[#82918c]"><span>{score.sectorCode}</span><span aria-hidden="true">·</span><span>{score.status === "scored" ? t.readyForReview : t.insufficientData}</span></span>
                            </button>
                          </td>
                          <td className="px-3 py-4 text-right">
                            <div className="ml-auto flex max-w-36 items-center justify-end gap-3"><span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#dfeee9]"><span className="block h-full rounded-full bg-[#3fd0b4]" style={{ width: `${score.score ?? 0}%` }} /></span><strong className="min-w-10 text-lg text-[#087e6b]">{score.score === null ? "—" : number.format(score.score)}</strong></div>
                          </td>
                          <td className="px-5 py-4 text-right sm:px-6"><span className="font-extrabold text-[#31453f]">{number.format(score.confidence)}</span><p className="mt-0.5 text-[11px] capitalize text-[#82918c]">{score.confidenceLabel}</p></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <aside id="evidence" aria-label={t.evidencePanel} className="min-w-0 scroll-mt-32 rounded-[24px] border border-[#dfe9e5] bg-white p-5 shadow-[0_12px_40px_rgba(24,38,35,0.05)] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#82918c]">{t.selectedSector}</p><h2 className="mt-2 text-xl font-extrabold leading-tight">{selected.sector}</h2><p className="mt-2 flex items-center gap-1.5 text-sm text-[#697c76]"><MapPin className="size-4 text-[#087e6b]" /> {selected.city}, Colombia</p></div>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e7f7f2] text-[#087e6b]"><ArrowUpRight className="size-5" /></span>
              </div>

              <div className="my-5 grid grid-cols-2 gap-3">
                <Metric icon={<Gauge className="size-4" />} label={t.opportunity} value={selected.score} locale={locale} />
                <Metric icon={<ShieldCheck className="size-4" />} label={t.confidence} value={selected.confidence} locale={locale} />
              </div>

              <Link
                href={`/prospects?sector=${encodeURIComponent(selected.sector)}`}
                className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#087e6b] px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(8,126,107,0.18)] transition hover:bg-[#076858]"
              >
                <Building2 className="size-4" />
                {t.viewProspectsForSector}
              </Link>

              <h3 className="mb-3 text-sm font-extrabold">{t.factorEvidence}</h3>
              <div className="space-y-3.5">
                {selected.factors.map((factor) => (
                  <FactorRow key={factor.key} factor={factor} evidenceLabel={t.evidence} locale={locale} />
                ))}
              </div>

              <details open className="group mt-5 border-t border-[#e6efec] pt-4">
                <summary className="cursor-pointer list-none text-sm font-extrabold text-[#31453f]">{t.confidenceModel} v{selected.confidenceModelVersion}</summary>
                <div className="mt-3 space-y-3">
                  {selected.confidenceFactors.map((factor) => (
                    <FactorRow key={factor.key} factor={factor} evidenceLabel={t.confidenceEvidence} compact locale={locale} />
                  ))}
                </div>
              </details>

              <h3 className="mb-3 mt-5 text-sm font-extrabold">{t.evidenceRecords}</h3>
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {selected.evidence.map((item) => (
                  <article id={`evidence-${item.id}`} key={item.id} className="scroll-mt-4 rounded-xl border border-[#e4ece9] bg-[#f8fbfa] p-3">
                    <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#087e6b]" /><div className="min-w-0"><p className="text-xs font-bold text-[#31453f]">{item.title}</p><p className="mt-1 text-[11px] leading-relaxed text-[#82918c]">{item.sourceName} · {t.observed} {item.observedAt} · {t.license} {item.licenseReviewStatus}</p><a href={item.sourceUri} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#087e6b] hover:underline">{t.openSource} {item.sourceName}<ArrowUpRight className="size-3" /></a></div></div>
                  </article>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#edf7f3] p-3">
                <Database className="size-4 shrink-0 text-[#087e6b]" />
                <div className="min-w-0"><p className="truncate text-sm font-extrabold">{selected.source.name}</p><p className="text-xs text-[#697c76]">{t.observed} {selected.source.observedAt} · {selected.source.licenseReviewStatus} {t.review}</p></div>
              </div>
            </aside>
          </section>

          <footer className="border-t border-[#dfe9e5] py-5 text-center text-xs text-[#82918c]">{t.footer}</footer>
        </main>
      </div>
    </div>
  );
}

function Navigation({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  const links = [
    { href: "#overview", label: t.overview, icon: <LayoutDashboard className="size-5" /> },
    { href: "#matrix", label: t.matrixTitle, icon: <LayoutGrid className="size-5" /> },
    { href: "#ranking", label: t.ranking, icon: <BarChart3 className="size-5" /> },
    { href: "#evidence", label: t.navEvidence, icon: <FileSearch className="size-5" /> },
    { href: "/prospects", label: t.prospectsNav, icon: <Building2 className="size-5" /> },
  ];

  return (
    <aside className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-[#dfe9e5] bg-white px-4 shadow-[0_4px_20px_rgba(24,38,35,0.04)] md:h-screen md:flex-col md:border-b-0 md:border-r md:px-0 md:py-5">
      <div className="flex items-center gap-3 md:flex-col md:gap-7">
        <a href="#overview" aria-label={t.home} className="grid size-11 place-items-center rounded-2xl bg-[#087e6b] text-lg font-extrabold text-white shadow-[0_8px_18px_rgba(8,126,107,0.22)]">N</a>
        <nav aria-label={t.primary} className="flex items-center gap-1.5 md:flex-col md:gap-2">
          {links.map((link, index) => <a key={link.href} href={link.href} aria-label={link.label} title={link.label} className={cn("grid size-10 place-items-center rounded-xl transition sm:size-11", index === 0 ? "bg-[#e7f7f2] text-[#087e6b]" : "text-[#7b8e88] hover:bg-[#f0f8f5] hover:text-[#087e6b]")}>{link.icon}</a>)}
        </nav>
      </div>
      <span className="hidden size-10 place-items-center rounded-xl bg-[#f5f9f7] text-[#7b8e88] md:grid" title={t.workspace}><Menu className="size-5" /></span>
    </aside>
  );
}

function KpiCard({ icon, label, value, unit, detail, emphasized = false }: { icon: ReactNode; label: string; value: string; unit?: string; detail: string; emphasized?: boolean }) {
  return (
    <article data-testid="dashboard-kpi" className={cn("relative min-h-44 overflow-hidden rounded-[24px] border p-5 shadow-[0_10px_30px_rgba(24,38,35,0.04)] sm:p-6", emphasized ? "border-[#087e6b] bg-[#087e6b] text-white" : "border-[#dfe9e5] bg-white text-[#182623]") }>
      {emphasized && <span aria-hidden="true" className="absolute -bottom-12 -right-10 size-36 rounded-full bg-white/10 blur-sm" />}
      <div className="relative flex h-full flex-col justify-between gap-5">
        <div className="flex items-center justify-between gap-3"><p className={cn("text-sm font-bold", emphasized ? "text-white/80" : "text-[#697c76]")}>{label}</p><span className={cn("grid size-10 place-items-center rounded-xl", emphasized ? "bg-white/15 text-white" : "bg-[#e7f7f2] text-[#087e6b]")}>{icon}</span></div>
        <div><p className="text-3xl font-extrabold tracking-tight"><span>{value}</span>{unit && <span className={cn("ml-1 text-xs font-bold", emphasized ? "text-white/60" : "text-[#82918c]")}>{unit}</span>}</p><p className={cn("mt-2 text-xs font-medium", emphasized ? "text-white/70" : "text-[#697c76]")}>{detail}</p></div>
      </div>
    </article>
  );
}

function Metric({ icon, label, value, locale }: { icon: ReactNode; label: string; value: number | null; locale: Locale }) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return (
    <div className="rounded-xl border border-[#dfe9e5] bg-[#f8fbfa] p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-[#697c76]"><span className="text-[#087e6b]">{icon}</span>{label}</div>
      <p className="mt-2 text-2xl font-extrabold text-[#182623]">{value === null ? "—" : number.format(value)}<span className="ml-1 text-[10px] font-bold text-[#82918c]">{getMessages(locale).outOf100}</span></p>
    </div>
  );
}

function FactorRow({ factor, evidenceLabel, compact = false, locale }: { factor: SectorScoreContract["factors"][number]; evidenceLabel: string; compact?: boolean; locale: Locale }) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const value = factor.value === null ? null : Math.round(factor.value * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-start justify-between gap-3 text-xs"><span className="font-semibold text-[#4b635c]">{factor.label}</span><span className="shrink-0 font-medium text-[#82918c]">{value === null ? getMessages(locale).missing : `${value}%`} · {compact ? `${number.format(factor.contribution ?? 0)} ${getMessages(locale).points}` : `w${factor.weight}`}</span></div>
      {!compact && <div className="h-1.5 overflow-hidden rounded-full bg-[#e1ece8]"><div className="h-full rounded-full bg-[#3fd0b4]" style={{ width: `${value ?? 0}%` }} /></div>}
      <a href={`#evidence-${factor.evidenceId}`} className="mt-1 inline-block max-w-full break-all text-[11px] font-bold text-[#087e6b] hover:underline">{evidenceLabel} {factor.evidenceId}</a>
    </div>
  );
}

function summarize(scores: SectorScoreContract[]) {
  const scored = scores.filter((score): score is SectorScoreContract & { score: number } => score.status === "scored" && score.score !== null);
  const top = scored[0];
  const average = (values: number[]) => values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    topScore: top?.score ?? null,
    topSector: top?.sector ?? null,
    averageScore: average(scored.map((score) => score.score)),
    averageConfidence: average(scores.map((score) => score.confidence)),
    scoredCount: scored.length,
    insufficientCount: scores.filter((score) => score.status === "insufficient_data").length,
  };
}
