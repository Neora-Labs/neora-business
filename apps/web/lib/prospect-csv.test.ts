import { describe, expect, it } from "vitest";
import { parseProspectCsv } from "./prospect-csv";

const header = "ID,Sector,Empresa,Señal de encaje,Propuesta inicial Neora Labs,Web / fuente pública,Prioridad,Estado,Decisor a localizar";
const row = "1,Services,Synthetic Company,Synthetic signal,Synthetic proposal,https://example.test,A,To contact,Gerencia";

describe("prospect CSV parser", () => {
  it("detects the exact header after a preamble without importing the preamble", () => {
    const result = parseProspectCsv(`Internal import\nNotes\n${header}\n${row}\n`);
    expect(result).toEqual({ records: [{ externalId: "1", companyName: "Synthetic Company", sector: "Services", fitSignal: "Synthetic signal", initialProposal: "Synthetic proposal", publicUrl: "https://example.test", priority: "A", outreachStatus: "To contact", decisionMakerRole: "Gerencia" }] });
  });

  it("ignores the source workbook's non-prospect summary columns", () => {
    const result = parseProspectCsv(`Preamble\n${header},,,Resumen,Cantidad\n${row},,,Services,1\n`);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.externalId).toBe("1");
  });

  it("rejects malformed URLs, missing required values, unknown headers, and duplicate IDs", () => {
    expect(() => parseProspectCsv(`${header}\n1,Services,,Signal,Proposal,https://example.test,A,To contact,Operations`)).toThrow(/company/i);
    expect(() => parseProspectCsv(`${header}\n1,Services,Company,Signal,Proposal,not-a-url,A,To contact,Operations`)).toThrow(/URL/i);
    expect(() => parseProspectCsv(`${header},Unexpected\n${row},x`)).toThrow(/header/i);
    expect(() => parseProspectCsv(`${header}\n${row}\n${row}`)).toThrow(/duplicate/i);
  });

  it("only accepts public http(s) URLs and controlled decision-maker roles", () => {
    expect(() => parseProspectCsv(`${header}\n1,Services,Company,Signal,Proposal,javascript:alert(1),A,To contact,Gerencia`)).toThrow(/publicUrl/i);
    expect(() => parseProspectCsv(`${header}\n1,Services,Company,Signal,Proposal,data:text/plain,test,A,To contact,Gerencia`)).toThrow(/publicUrl/i);
    expect(() => parseProspectCsv(`${header}\n1,Services,Company,Signal,Proposal,https://example.test,A,To contact,Jane Doe`)).toThrow(/decisionMakerRole/i);
    expect(() => parseProspectCsv(`${header}\n1,Services,Company,Signal,Proposal,https://example.test,A,To contact,person@example.test`)).toThrow(/decisionMakerRole/i);
    expect(() => parseProspectCsv(`${header}\n1,Services,Company,Signal,Proposal,https://example.test,A,To contact,+57 300 123 4567`)).toThrow(/decisionMakerRole/i);
  });
});
