import "../apps/api/src/config/env";
import { randomUUID } from "node:crypto";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Database } from "../apps/api/src/database/database";
import { StorageService } from "../apps/api/src/modules/storage/storage.service";
import { PDFDocument } from "pdf-lib";
import { required } from "../apps/api/src/config/env";
import { sha256 } from "../apps/api/src/common/crypto";
async function main() {
  const db = new Database(),
    storage = new StorageService(),
    key = `connectivity-checks/${randomUUID()}.pdf`;
  const client = new S3Client({
    endpoint: required("AWS_ENDPOINT_URL_S3"),
    region: required("AWS_REGION"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required("AWS_ACCESS_KEY_ID"),
      secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  try {
    const tables = await db.query(
      "SELECT count(*)::int count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    await storage.assertPrivate();
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    await storage.put(key, bytes, "application/pdf");
    const read = await storage.get(key);
    if (sha256(bytes) !== sha256(read)) throw new Error("Hash divergente");
    console.log(
      JSON.stringify({
        database: true,
        tables: tables.rows[0].count,
        privateBucket: true,
        pdfUpload: true,
        pdfDownload: true,
        integrity: true,
      }),
    );
  } finally {
    await client.send(
      new DeleteObjectCommand({ Bucket: required("STORAGE_BUCKET"), Key: key }),
    );
    await db.onModuleDestroy();
  }
}
main().catch(() => {
  console.error("Falha no teste de conectividade Neon");
  process.exit(1);
});
