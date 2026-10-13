import { Injectable } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  GetBucketAclCommand,
} from "@aws-sdk/client-s3";
import { required } from "../../config/env";
import { sha256 } from "../../common/crypto";
export abstract class ObjectStorage {
  abstract put(key: string, bytes: Uint8Array, type: string): Promise<void>;
  abstract get(key: string): Promise<Uint8Array>;
}
@Injectable()
export class StorageService extends ObjectStorage {
  private client = new S3Client({
    endpoint: required("AWS_ENDPOINT_URL_S3"),
    region: required("AWS_REGION"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required("AWS_ACCESS_KEY_ID"),
      secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  private bucket = required("STORAGE_BUCKET");
  async assertPrivate() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    const acl = await this.client.send(
      new GetBucketAclCommand({ Bucket: this.bucket }),
    );
    if (
      acl.Grants?.some(
        (g) =>
          g.Grantee?.URI?.includes("AllUsers") ||
          g.Grantee?.URI?.includes("AuthenticatedUsers"),
      )
    )
      throw new Error("O bucket precisa ser privado");
  }
  async put(key: string, bytes: Uint8Array, type: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: type,
        CacheControl: "private, no-store",
        Metadata: { sha256: sha256(bytes) },
      }),
    );
    const saved = await this.get(key);
    if (sha256(saved) !== sha256(bytes))
      throw new Error("Falha de integridade no armazenamento");
  }
  async get(key: string) {
    const r = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!r.Body) throw new Error("Objeto indisponível");
    return r.Body.transformToByteArray();
  }
}
