import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { S3RawAssetStore } from "../src/index";

describe("S3 immutable raw assets", () => {
  it("returns the content-addressed URI when the object already exists", async () => {
    const directory = await mkdtemp(join(tmpdir(), "neora-s3-"));
    const path = join(directory, "sample.csv");
    await writeFile(path, "city,sector\nBogotá,health\n");
    const send = vi.fn().mockRejectedValue(Object.assign(new Error("Precondition failed"), {
      name: "PreconditionFailed",
      $metadata: { httpStatusCode: 412 }
    }));
    const store = new S3RawAssetStore("raw-bucket", "sa-east-1", { send } as never);

    await expect(store.putImmutable({ path, checksum: "abc123", contentType: "text/csv" }))
      .resolves.toBe("s3://raw-bucket/raw/sha256/abc123/sample.csv");
  });

  it("does not hide unrelated upload failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "neora-s3-"));
    const path = join(directory, "sample.csv");
    await writeFile(path, "data");
    const failure = new Error("network unavailable");
    const store = new S3RawAssetStore("raw-bucket", "sa-east-1", { send: vi.fn().mockRejectedValue(failure) } as never);
    await expect(store.putImmutable({ path, checksum: "abc123", contentType: "text/csv" })).rejects.toBe(failure);
  });
});
