from __future__ import annotations
from pathlib import Path
from typing import Iterable, Mapping, Any
import csv

BOGOTA_DEPARTMENT = "11"
BOGOTA_AREA = "11"
GROUP_12 = {
    "01": "agriculture", "02": "mining", "03": "manufacturing", "04": "construction",
    "05": "trade_and_repair", "06": "transport_and_storage", "07": "accommodation_and_food",
    "08": "information_and_communications", "09": "real_estate_professional_and_administrative",
    "10": "education", "11": "health_and_social_assistance", "12": "arts_entertainment_and_other_services",
}

def require_emicron_labels(variable_keys: Iterable[str], labels: Mapping[str, str]) -> None:
    missing = [key for key in variable_keys if key.upper().startswith("P") and key[1:].isdigit() and not labels.get(key, "").strip()]
    if missing:
        raise ValueError(f"EMICRON dictionary labels required before interpreting: {', '.join(missing)}")

def aggregate_emicron_bogota(rows: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    selected = [row for row in rows if str(row.get("COD_DEPTO")) == BOGOTA_DEPARTMENT and str(row.get("AREA")) == BOGOTA_AREA]
    weighted = 0.0
    groups: dict[str, float] = {}
    for row in selected:
        try: weight = float(row["F_EXP"])
        except (KeyError, TypeError, ValueError) as error: raise ValueError("EMICRON Bogotá aggregation requires F_EXP") from error
        group = str(row.get("GRUPOS12", ""))
        if group not in GROUP_12: continue
        weighted += weight; groups[group] = groups.get(group, 0.0) + weight
    return {"geography": "Bogotá", "unweighted_records": len(selected), "weighted_records": weighted, "groups": groups,
            "evidence_type": "group_12", "ciiu_version": "ciiu_4ac_2022", "ciiu_level": "group_12", "division_metrics": None,
            "confidence_penalty": "group_12_not_division"}

def load_ica_crosswalk(path: Path | None = None) -> dict[str, dict[str, Any]]:
    if path is None:
        path = Path(__file__).resolve().parents[2] / "data" / "catalog" / "ica_ciiu_crosswalk.json"
    if not path.exists():
        return {}
    import json
    data = json.loads(path.read_text(encoding="utf-8"))
    return {str(item["source_code"]): item for item in data.get("mappings", [])}

def load_ciiu_divisions(path: Path | None = None) -> dict[str, dict[str, str]]:
    if path is None:
        path = Path(__file__).resolve().parents[2] / "data" / "catalog" / "ciiu_divisions_v4.json"
    if not path.exists():
        return {}
    import json
    items = json.loads(path.read_text(encoding="utf-8"))
    return {item["code"]: item for item in items}

def parse_ica_csv(path: Path, crosswalk: Mapping[str, Mapping[str, Any]] | None = None) -> list[dict[str, Any]]:
    divisions = load_ciiu_divisions() if crosswalk is not None else {}
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="cp1252", newline="") as stream:
        for row in csv.DictReader(stream, delimiter=";"):
            code = (row.get("CODIGO CIIU SHD") or "").strip()
            desc = (row.get("DESCRIPCION CIIU") or "").strip()
            if crosswalk is None:
                records.append({
                    "source_code": code,
                    "source_description": desc,
                    "target_ciiu_division": None,
                    "mapping_status": "unresolved"
                })
                continue

            raw_val = (row.get("RECAUDO BIMESTRAL Y/O ANUAL") or row.get("VALOR") or row.get("VALOR RECAUDO") or "").strip()
            year = (row.get("VIGENCIA") or row.get("AÑO") or "").strip()
            val = None
            if raw_val:
                try:
                    cleaned = raw_val.replace("$", "").replace(" ", "").replace(".", "").replace(",", ".")
                    val = float(cleaned)
                except ValueError:
                    val = None

            entry = crosswalk.get(code)
            if entry:
                div = entry.get("target_ciiu_division")
                cls_code = entry.get("target_ciiu_class")
                method = entry.get("mapping_method")
                url = entry.get("evidence_url")
                status = entry.get("mapping_status", "verified")
            elif len(code) >= 2 and code[:2] in divisions:
                div = code[:2]
                cls_code = code if len(code) == 4 else None
                method = "Prefijo directo de 2 dígitos a división CIIU Rev. 4 A.C."
                url = "https://www.shd.gov.co/shd/clasificacion-industrial-internacional-uniforme-ciiu"
                status = "verified"
            else:
                div = None
                cls_code = None
                method = None
                url = None
                status = "unresolved"

            records.append({
                "source_code": code,
                "source_description": desc,
                "target_ciiu_division": div,
                "target_ciiu_class": cls_code,
                "mapping_method": method,
                "evidence_url": url,
                "mapping_status": status,
                "year": year or None,
                "recaudo_value": val
            })
    return records

def aggregate_ica_divisions(records: Iterable[Mapping[str, Any]], division_catalog: Mapping[str, Mapping[str, str]] | None = None) -> list[dict[str, Any]]:
    if division_catalog is None:
        division_catalog = load_ciiu_divisions()
    by_division: dict[str, list[Mapping[str, Any]]] = {}
    for record in records:
        div = record.get("target_ciiu_division")
        if div and record.get("mapping_status") == "verified":
            by_division.setdefault(div, []).append(record)

    results: list[dict[str, Any]] = []
    for div_code, items in sorted(by_division.items()):
        values = [r["recaudo_value"] for r in items if r.get("recaudo_value") is not None]
        total_recaudo = sum(values) if values else 0.0

        # Recaudo por año
        by_year: dict[str, float] = {}
        for r in items:
            yr = r.get("year")
            val = r.get("recaudo_value")
            if yr and val is not None:
                by_year[str(yr)] = by_year.get(str(yr), 0.0) + val

        sorted_years = sorted(by_year.keys())
        cagr = None
        if len(sorted_years) >= 2:
            y_first, y_last = sorted_years[0], sorted_years[-1]
            n_years = int(y_last) - int(y_first) if y_last.isdigit() and y_first.isdigit() else len(sorted_years) - 1
            if n_years > 0 and by_year[y_first] > 0 and by_year[y_last] > 0:
                cagr = (by_year[y_last] / by_year[y_first]) ** (1.0 / n_years) - 1.0

        div_info = division_catalog.get(div_code, {})
        results.append({
            "division_code": div_code,
            "division_name": div_info.get("name", f"División {div_code}"),
            "section": div_info.get("section"),
            "section_name": div_info.get("sectionName"),
            "recaudo_total": total_recaudo,
            "recaudo_por_año": by_year,
            "recaudo_reciente": by_year.get(sorted_years[-1]) if sorted_years else (values[-1] if values else None),
            "cagr_dinamismo": cagr,
            "registros_observados": len(items),
            "evidence_type": "observed",
            "ciiu_version": "ciiu_4ac_2022"
        })
    return results

