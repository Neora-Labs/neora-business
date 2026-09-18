from __future__ import annotations

from typing import Any

import polars as pl

CITY_ALIASES = {
    "bogota": "Bogotá", "bogota d.c.": "Bogotá", "bogotá": "Bogotá", "bogotá d.c.": "Bogotá",
    "medellin": "Medellín", "medellín": "Medellín", "cali": "Cali",
}
SECTORS = {
    "construction": "Construcción e instaladores", "health": "Clínicas y bienestar",
    "real_estate": "Inmobiliarias", "technical_services": "Talleres y servicios técnicos",
    "education": "Academias y servicios profesionales",
}
FACTOR_COLUMNS = ["digital_gap", "automation_potential", "economic_capacity", "accessible_market", "competitive_pressure", "service_fit", "accessibility"]


def normalize_city(value: str | None) -> str | None:
    if not value:
        return None
    return CITY_ALIASES.get(value.strip().lower())


def _nullable_float(value: Any) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    parsed = float(value)
    if not 0 <= parsed <= 1:
        raise ValueError("Normalized factors must be between 0 and 1")
    return parsed


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    city = normalize_city(row.get("city"))
    if city is None:
        raise ValueError("City is outside the Colombian pilot")
    sector_code = str(row.get("sector_code", ""))
    if sector_code and sector_code not in SECTORS:
        raise ValueError("Unknown pilot sector")
    normalized = dict(row)
    normalized["city"] = city
    normalized["sector"] = SECTORS.get(sector_code, row.get("sector"))
    for column in FACTOR_COLUMNS:
        normalized[column] = _nullable_float(row.get(column))
    return normalized


def normalize_frame(frame: pl.DataFrame) -> pl.DataFrame:
    return pl.DataFrame([normalize_row(row) for row in frame.to_dicts()])
