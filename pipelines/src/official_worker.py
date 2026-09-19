"""Worker-only transforms for admitted official uploads.

This module deliberately has no web imports. A queue consumer invokes it after a second
identity approves an immutable raw S3 object; it returns aggregate evidence only.
"""
from __future__ import annotations
from pathlib import Path
from typing import Mapping, Iterable, Any
from .official_sources import aggregate_emicron_bogota, parse_ica_csv, require_emicron_labels
import argparse
import csv
import json


def process_emicron_csv(path: Path, variable_labels: Mapping[str, str], used_variables: Iterable[str]) -> dict[str, Any]:
    """Produce non-divisional GRUPOS12 context from EMICRON with DANE labels required."""
    require_emicron_labels(used_variables, variable_labels)
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        result = aggregate_emicron_bogota(csv.DictReader(stream))
    return {**result, "raw_format": "csv", "worker_contract": "official-emicron-v1"}


def process_ica_csv(path: Path) -> dict[str, Any]:
    """ICA is stored as raw observations only until an independently verified crosswalk exists."""
    rows = parse_ica_csv(path)
    return {
        "raw_format": "cp1252:semicolon_csv", "records": rows, "metric_rows": [],
        "status": "blocked_mapping" if rows else "completed", "worker_contract": "official-ica-v1",
        "reason": "CIIU SHD codes are unresolved; no division metric was generated" if rows else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Process one approved official source outside Next.js")
    parser.add_argument("--source", choices=("emicron", "ica"), required=True)
    parser.add_argument("--input", type=Path, required=True, help="Immutable raw object downloaded by the queue worker")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--labels", type=Path, help="EMICRON dictionary labels JSON")
    parser.add_argument("--used-variable", action="append", default=[])
    args = parser.parse_args()
    if args.source == "emicron":
        if args.labels is None: raise SystemExit("--labels is required for EMICRON")
        result = process_emicron_csv(args.input, json.loads(args.labels.read_text(encoding="utf-8")), args.used_variable)
    else:
        result = process_ica_csv(args.input)
    args.output.write_text(json.dumps(result, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
