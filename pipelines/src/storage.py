from __future__ import annotations

from pathlib import Path


class S3RawAssetStore:
    """Thin S3 adapter. Bucket versioning must be enabled outside the application."""
    def __init__(self, client, bucket: str):
        self.client = client
        self.bucket = bucket

    def put_immutable(self, path: Path, checksum: str) -> str:
        key = f"raw/sha256/{checksum}/{path.name}"
        self.client.upload_file(str(path), self.bucket, key, ExtraArgs={"Metadata": {"sha256": checksum}})
        return f"s3://{self.bucket}/{key}"
