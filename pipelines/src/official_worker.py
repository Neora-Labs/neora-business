"""Worker-only transforms for admitted official uploads.

This module deliberately has no web imports. A queue consumer invokes it after a second
identity approves an immutable raw S3 object; it returns aggregate evidence only.
"""
from __future__ import annotations
from pathlib import Path
from typing import Mapping, Iterable, Any
from .official_sources import aggregate_emicron_bogota, aggregate_ica_divisions, parse_ica_csv, require_emicron_labels, load_ica_crosswalk


def process_emicron_csv(path: Path, variable_labels: Mapping[str, str], used_variables: Iterable[str]) -> dict[str, Any]:
    """Produce non-divisional GRUPOS12 context from EMICRON with DANE labels required."""
    require_emicron_labels(used_variables, variable_labels)
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        result = aggregate_emicron_bogota(csv.DictReader(stream))
    return {**result, "raw_format": "csv", "worker_contract": "official-emicron-v1"}


def process_ica_csv(path: Path, crosswalk: Mapping[str, Mapping[str, Any]] | None = None) -> dict[str, Any]:
    """ICA is stored as raw observations only until an independently verified crosswalk exists."""
    rows = parse_ica_csv(path, crosswalk=crosswalk)
    if not rows:
        return {
            "raw_format": "cp1252:semicolon_csv", "records": [], "metric_rows": [],
            "status": "completed", "worker_contract": "official-ica-v1", "reason": None,
        }
    if crosswalk is None:
        return {
            "raw_format": "cp1252:semicolon_csv", "records": rows, "metric_rows": [],
            "status": "blocked_mapping", "worker_contract": "official-ica-v1",
            "reason": "CIIU SHD codes are unresolved; no division metric was generated",
        }
    metrics = aggregate_ica_divisions(rows)
    all_verified = all(r.get("mapping_status") == "verified" for r in rows)
    return {
        "raw_format": "cp1252:semicolon_csv",
        "records": rows,
        "metric_rows": metrics,
        "status": "completed" if all_verified and metrics else ("completed" if metrics else "blocked_mapping"),
        "worker_contract": "official-ica-v1",
        "reason": None if all_verified else "Some CIIU SHD codes remain unresolved",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Process one approved official source outside Next.js")
    parser.add_argument("--source", choices=("emicron", "ica"), required=True)
    parser.add_argument("--input", type=Path, required=True, help="Immutable raw object downloaded by the queue worker")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--labels", type=Path, help="EMICRON dictionary labels JSON")
    parser.add_argument("--crosswalk", type=Path, help="Path to verified ICA-CIIU crosswalk JSON")
    parser.add_argument("--used-variable", action="append", default=[])
    args = parser.parse_args()
    if args.source == "emicron":
        if args.labels is None: raise SystemExit("--labels is required for EMICRON")
        result = process_emicron_csv(args.input, json.loads(args.labels.read_text(encoding="utf-8")), args.used_variable)
    else:
        crosswalk = load_ica_crosswalk(args.crosswalk) if args.crosswalk or Path("data/catalog/ica_ciiu_crosswalk.json").exists() else None
        result = process_ica_csv(args.input, crosswalk=crosswalk)
    args.output.write_text(json.dumps(result, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
