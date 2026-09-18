from __future__ import annotations

import pandera.polars as pa
import polars as pl

from pipelines.src.normalize.colombia import FACTOR_COLUMNS

SECTOR_METRICS_SCHEMA = pa.DataFrameSchema({
    "city": pa.Column(str, nullable=False),
    "sector_code": pa.Column(str, nullable=False),
    "period": pa.Column(int, nullable=False),
    **{column: pa.Column(float, checks=pa.Check.in_range(0, 1), nullable=True) for column in FACTOR_COLUMNS},
    "authority": pa.Column(float, checks=pa.Check.in_range(0, 1), nullable=False),
    "completeness": pa.Column(float, checks=pa.Check.in_range(0, 1), nullable=False),
    "freshness": pa.Column(float, checks=pa.Check.in_range(0, 1), nullable=False),
    "consistency": pa.Column(float, checks=pa.Check.in_range(0, 1), nullable=False),
    "entity_resolution": pa.Column(float, checks=pa.Check.in_range(0, 1), nullable=False),
})


def validate_sector_metrics(frame: pl.DataFrame) -> list[str]:
    try:
        SECTOR_METRICS_SCHEMA.validate(frame, lazy=True)
        return []
    except pa.errors.SchemaErrors as error:
        cases = error.failure_cases
        return sorted({f"{row.get('column', 'schema')}: {row.get('failure_case', 'invalid')}" for row in cases.to_dicts()})
