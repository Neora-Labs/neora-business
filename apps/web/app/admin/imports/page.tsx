"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LocaleSelector } from "@/components/locale-selector";
import { getMessages, type Locale } from "@/lib/i18n";

type RequestRow = { id: string; sourceKind: "emicron" | "ica"; fileName: string; period: string; datasetVersion: string; status: string; ciiuVersion: string; rawKey: string; evidenceType: string; };
const sources = {
  emicron: { url: "https://microdatos.dane.gov.co/index.php/catalog/914/data-dictionary", license: null, label: "EMICRON 2025 — DANE / DIMPE" },
  ica: { url: "https://datosabiertos.bogota.gov.co/dataset/62be0dca-281d-4dee-b27e-c65153e9c9bf/resource/b59cbca5-21d1-4854-98ed-be6bfd2b3a32/download/19.-recaudo_ica_sector_ciiu_2007_2023.csv", license: "CC BY 4.0", label: "ICA 2007–2023 — Secretaría Distrital de Hacienda" }
} as const;
async function checksum(file: File) { const buffer = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
export default function AdminImportsPage() {
  const locale: Locale = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "es"; const t = getMessages(locale);
  const [items, setItems] = useState<RequestRow[]>([]); const [file, setFile] = useState<File | null>(null); const [kind, setKind] = useState<keyof typeof sources>("emicron");
  const [period, setPeriod] = useState("2025"); const [version, setVersion] = useState("2025"); const [labels, setLabels] = useState("{}"); const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const reload = async () => { const response = await fetch("/api/admin/imports", { cache: "no-store" }); if (response.ok) setItems((await response.json()).data); };
  useEffect(() => { queueMicrotask(() => { void reload(); }); }, []);
  const submit = async () => {
    if (!file) { setMessage(t.chooseFile); return; }
    setBusy(true); setMessage(null);
    try {
      let variableLabels: Record<string, string> = {}; try { variableLabels = kind === "emicron" ? JSON.parse(labels) as Record<string, string> : {}; } catch { throw new Error(t.invalidJson); }
      const metadata = { sourceKind: kind, fileName: file.name, checksumSha256: await checksum(file), byteSize: file.size, officialUrl: sources[kind].url, licenseName: sources[kind].license, period, datasetVersion: version, variableLabels };
      const planResponse = await fetch("/api/admin/imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "upload-plan", metadata, contentType: file.type || "application/octet-stream" }) });
      const plan = await planResponse.json(); if (!planResponse.ok) throw new Error(plan.error ?? t.uploadPrepareError);
      if (!plan.uploadUrl) throw new Error(t.storageMissing);
      const upload = await fetch(plan.uploadUrl, { method: "PUT", headers: plan.requiredHeaders, body: file }); if (!upload.ok) throw new Error(t.uploadRejected);
      const confirm = await fetch("/api/admin/imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confirm-upload", metadata }) });
      const result = await confirm.json(); if (!confirm.ok) throw new Error(result.error ?? t.confirmError);
      setMessage(t.received); await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : t.unexpectedError); } finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-5xl p-6 md:p-10"><Link href="/" className="text-sm font-semibold text-[var(--neora-primary)]">← {t.back}</Link>
    <div className="flex items-end justify-between gap-4"><h1 className="mt-5 text-3xl font-bold tracking-tight">{t.importOfficial}</h1><LocaleSelector locale={locale} /></div><p className="mt-2 max-w-3xl text-[var(--neora-muted)]">{t.importDescription}</p>
    <section className="mt-8 grid gap-6 rounded-3xl border border-[var(--neora-border)] bg-white p-6 shadow-sm md:grid-cols-2"><div className="space-y-4"><label className="block text-sm font-semibold">{t.source}<select value={kind} onChange={(event) => setKind(event.target.value as keyof typeof sources)} className="mt-1 w-full rounded-xl border border-[var(--neora-border)] bg-white p-3"><option value="emicron">{sources.emicron.label}</option><option value="ica">{sources.ica.label}</option></select></label><p className="text-xs text-[var(--neora-muted)]">{t.requiredCiiu}: <b>Rev. 4 A.C. (2022)</b>. {kind === "emicron" ? "EMICRON sólo genera evidencia contextual GRUPOS12; no scores por división." : "ICA queda bloqueado hasta homologar cada código SHD de forma verificable."}</p><label className="block text-sm font-semibold">{t.localFile}<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">{t.period}<input value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--neora-border)] p-3" /></label><label className="text-sm font-semibold">{t.version}<input value={version} onChange={(event) => setVersion(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--neora-border)] p-3" /></label></div></div>
      <div className="space-y-4">{kind === "emicron" && <label className="block text-sm font-semibold">{t.dictionaryLabels}<textarea value={labels} onChange={(event) => setLabels(event.target.value)} rows={7} className="mt-1 w-full rounded-xl border border-[var(--neora-border)] p-3 font-mono text-xs" aria-describedby="labels-help" /><span id="labels-help" className="mt-1 block text-xs text-[var(--neora-muted)]">{t.dictionaryHelp}</span></label>}<div className="rounded-2xl bg-[var(--neora-accent)] p-4 text-sm"><b>{t.protections}</b><ul className="mt-2 list-disc space-y-1 pl-5"><li>{t.checksum}</li><li>{t.immutablePath}</li><li>{t.separateReviewer}</li><li>{t.unresolvedMapping}</li></ul></div><button onClick={() => void submit()} disabled={busy} className="w-full rounded-xl bg-[var(--neora-primary)] px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? t.preparing : t.uploadReview}</button>{message && <p role="status" className="text-sm text-[var(--neora-tertiary)]">{message}</p>}</div></section>
    <section className="mt-8"><h2 className="text-xl font-bold">{t.recentRequests}</h2><div className="mt-3 overflow-hidden rounded-2xl border border-[var(--neora-border)] bg-white">{items.length === 0 ? <p className="p-5 text-sm text-[var(--neora-muted)]">{t.noRequests}</p> : <table className="w-full text-left text-sm"><thead className="bg-[var(--neora-accent)] text-[var(--neora-tertiary)]"><tr><th className="p-3">{t.file}</th><th>{t.source}</th><th>{t.status}</th><th>{t.rule}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-[var(--neora-border)]"><td className="p-3">{item.fileName}<br/><span className="text-xs text-[var(--neora-muted)]">{item.period}</span></td><td>{item.sourceKind}</td><td>{item.status}</td><td className="text-xs">{item.evidenceType}</td></tr>)}</tbody></table>}</div></section>
  </main>;
}





