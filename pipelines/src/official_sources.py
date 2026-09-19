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

def parse_ica_csv(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="cp1252", newline="") as stream:
        return [{"source_code": (row.get("CODIGO CIIU SHD") or "").strip(),
                 "source_description": (row.get("DESCRIPCION CIIU") or "").strip(),
                 "target_ciiu_division": None, "mapping_status": "unresolved"}
                for row in csv.DictReader(stream, delimiter=";")]
