import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { basename } from "node:path";
import { dirname, resolve } from "node:path";

export interface RawAssetStore { putImmutable(input: { path: string; checksum: string; contentType: string }): Promise<string> }
export interface PresignedRawUpload {
  key: string;
  uri: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

/** Direct browser upload boundary.  The caller must first hash the local file;
 * this adapter signs a conditional PUT so a content-addressed object cannot be replaced. */
export class S3PresignedRawUploadStore {
  readonly #client: S3Client;
  constructor(private readonly bucket: string, region = "sa-east-1", client?: S3Client, endpoint?: string) {
    this.#client = client ?? new S3Client({ region, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) });
  }
  async create(input: { checksum: string; fileName: string; contentType: string; expiresInSeconds?: number }): Promise<PresignedRawUpload> {
    if (!/^[a-f0-9]{64}$/i.test(input.checksum)) throw new Error("checksum must be SHA-256 hex");
    const name = basename(input.fileName);
    if (!name || name !== input.fileName) throw new Error("fileName must be a basename");
    const key = `raw/sha256/${input.checksum.toLowerCase()}/${name}`;
    const uploadUrl = await getSignedUrl(this.#client, new PutObjectCommand({
      Bucket: this.bucket, Key: key, ContentType: input.contentType, Metadata: { sha256: input.checksum.toLowerCase() }, IfNoneMatch: "*"
    }), { expiresIn: input.expiresInSeconds ?? 900 });
    const expiresAt = new Date(Date.now() + (input.expiresInSeconds ?? 900) * 1000).toISOString();
    return { key, uri: `s3://${this.bucket}/${key}`, uploadUrl, requiredHeaders: { "content-type": input.contentType, "if-none-match": "*", "x-amz-meta-sha256": input.checksum.toLowerCase() }, expiresAt };
  }
}
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
