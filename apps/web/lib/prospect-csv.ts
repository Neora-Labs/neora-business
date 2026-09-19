import { prospectInputSchema, type ProspectInputContract } from "@neora/contracts";

const EXPECTED_HEADERS = ["ID", "Sector", "Empresa", "Señal de encaje", "Propuesta inicial Neora Labs", "Web / fuente pública", "Prioridad", "Estado", "Decisor a localizar"] as const;

export type ParsedProspect = ProspectInputContract;

export function parseProspectCsv(content: string): { records: ParsedProspect[] } {
  const rows = parseCsv(content.replace(/^\uFEFF/, ""));
  const headerIndex = rows.findIndex((row) => isExpectedHeader(row));
  if (headerIndex < 0) throw new Error("Expected prospect CSV header was not found");
  const records: ParsedProspect[] = []; const ids = new Set<string>();
  for (const row of rows.slice(headerIndex + 1)) {
    const values = row.slice(0, EXPECTED_HEADERS.length).map((value) => value.trim());
    if (values.every((value) => value === "")) continue;
    const [externalId, sector, companyName, fitSignal, initialProposal, publicUrl, priority, outreachStatus, decisionMakerRole] = values;
    if (!externalId) continue;
    if (ids.has(externalId)) throw new Error("Duplicate prospect ID in CSV"); ids.add(externalId);
    const parsed = prospectInputSchema.safeParse({ externalId, sector, companyName, fitSignal, initialProposal, publicUrl, priority, outreachStatus, decisionMakerRole });
    if (!parsed.success) throw new Error(`Invalid prospect record ${externalId}: ${parsed.error.issues.map((issue) => `${String(issue.path[0] ?? "field")}: ${issue.message}`).join(", ")}`);
    records.push(parsed.data);
  }
  if (records.length === 0) throw new Error("The CSV did not contain prospect records");
  return { records };
}

function isExpectedHeader(row: string[]): boolean {
  if (!EXPECTED_HEADERS.every((header, index) => row[index]?.trim() === header)) return false;
  const trailing = row.slice(EXPECTED_HEADERS.length).map((value) => value.trim());
  return trailing.length === 0 || trailing.every((value) => value === "") || (trailing[0] === "" && trailing[1] === "" && trailing[2] === "Resumen" && trailing[3] === "Cantidad" && trailing.slice(4).every((value) => value === ""));
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') { if (quoted && content[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; continue; }
    if (character === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = ""; continue;
    }
    cell += character;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted value");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
