from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipelines.src.connectors.sample_colombia import SampleColombiaConnector
from pipelines.src.connectors.sample_colombia import LoadResult, NormalizedBatch


class FileHandoffSink:
    def __init__(self, path: Path): self.path = path
    def persist(self, batch: NormalizedBatch) -> LoadResult:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps({"checksum": batch.checksum, "rows": batch.rows}, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)
        return LoadResult(str(self.path), len(batch.rows))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the synthetic Colombia vertical-slice connector")
    parser.add_argument("--raw-dir", type=Path, default=Path("pipelines/raw"))
    parser.add_argument("--handoff", type=Path, default=Path("data/runtime/normalized-batch.json"))
    args = parser.parse_args()
    connector = SampleColombiaConnector(args.raw_dir)
    descriptor = connector.discover()[0]
    asset = connector.acquire(descriptor)
    quality = connector.validate_raw(asset)
    if not quality["passed"]:
        raise SystemExit(f"Quality checks failed: {quality['issues']}")
    batch = connector.normalize(asset)
    result = connector.load(batch, FileHandoffSink(args.handoff))
    print(json.dumps({"checksum": asset.checksum, "rows": result.rows, "synthetic": True, "handoff": result.location}, sort_keys=True))


if __name__ == "__main__":
    main()
