from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import polars as pl

from pipelines.src.normalize.colombia import normalize_frame
from pipelines.src.quality.sector_metrics import validate_sector_metrics


@dataclass(frozen=True)
class DatasetDescriptor:
    id: str
    period: str
    is_synthetic: bool
    source_path: Path


@dataclass(frozen=True)
class RawAsset:
    path: Path
    checksum: str
    byte_size: int


@dataclass(frozen=True)
class NormalizedBatch:
    checksum: str
    rows: list[dict[str, object]]


@dataclass(frozen=True)
class LoadResult:
    location: str
    rows: int


class LoadSink(Protocol):
    def persist(self, batch: NormalizedBatch) -> LoadResult: ...


class SampleColombiaConnector:
    """Manual connector for a synthetic aggregate fixture; never production evidence."""

    def __init__(self, raw_directory: Path, source_path: Path | None = None):
        self.raw_directory = raw_directory
        self.source_path = source_path or Path(__file__).parents[3] / "data" / "samples" / "colombia_sector_metrics.synthetic.csv"

    def discover(self) -> list[DatasetDescriptor]:
        return [DatasetDescriptor("colombia-sector-synthetic-v1", "2025", True, self.source_path)]

    def acquire(self, dataset: DatasetDescriptor) -> RawAsset:
        payload = dataset.source_path.read_bytes()
        checksum = hashlib.sha256(payload).hexdigest()
        destination = self.raw_directory / f"{checksum}.csv"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copyfile(dataset.source_path, destination)
        return RawAsset(destination, checksum, len(payload))

    def validate_raw(self, asset: RawAsset) -> dict[str, object]:
        frame = pl.read_csv(asset.path, null_values=[""])
        required = {"city", "sector_code", "period", "digital_gap", "automation_potential"}
        missing = required.difference(frame.columns)
        issues = [f"missing:{name}" for name in sorted(missing)]
        if not missing:
            issues.extend(validate_sector_metrics(frame))
        if frame.height != 15:
            issues.append(f"row_count: expected 15, got {frame.height}")
        return {"passed": not issues, "issues": issues}

    def normalize(self, asset: RawAsset) -> NormalizedBatch:
        return NormalizedBatch(asset.checksum, normalize_frame(pl.read_csv(asset.path, null_values=[""])).to_dicts())

    def load(self, batch: NormalizedBatch, sink: LoadSink) -> LoadResult:
        return sink.persist(batch)

    def load_manifest(self, asset: RawAsset, normalized_rows: list[dict[str, object]]) -> str:
        return json.dumps({"checksum": asset.checksum, "rows": len(normalized_rows), "synthetic": True}, sort_keys=True)
