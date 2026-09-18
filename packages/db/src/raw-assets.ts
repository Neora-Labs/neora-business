import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { basename } from "node:path";
import { dirname, resolve } from "node:path";

export interface RawAssetStore { putImmutable(input: { path: string; checksum: string; contentType: string }): Promise<string> }
export class S3RawAssetStore implements RawAssetStore {
  readonly #client: S3Client;
  constructor(private readonly bucket: string, region = "sa-east-1", client?: S3Client, endpoint?: string) {
    this.#client = client ?? new S3Client({ region, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) });
  }
  async putImmutable(input: { path: string; checksum: string; contentType: string }): Promise<string> {
    const key = `raw/sha256/${input.checksum}/${basename(input.path)}`;
    try {
      await this.#client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: createReadStream(input.path), ContentType: input.contentType, Metadata: { sha256: input.checksum }, IfNoneMatch: "*" }));
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status !== 412 && (error as { name?: string }).name !== "PreconditionFailed") throw error;
    }
    return `s3://${this.bucket}/${key}`;
  }
}

export class LocalRawAssetStore implements RawAssetStore {
  constructor(private readonly directory: string) {}
  async putImmutable(input: { path: string; checksum: string; contentType: string }): Promise<string> {
    const destination = resolve(this.directory, input.checksum, basename(input.path));
    await mkdir(dirname(destination), { recursive: true });
    try { await copyFile(input.path, destination, 1); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    return `local-demo://raw/${input.checksum}/${basename(input.path)}`;
  }
}
