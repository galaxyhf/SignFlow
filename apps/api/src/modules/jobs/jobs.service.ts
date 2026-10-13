import { Inject, Injectable, ConflictException } from "@nestjs/common";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { Database } from "../../database/database";
import { DocumentsRepository } from "../documents/documents.repository";
import { FilesService } from "../documents/files.service";
import { ObjectStorage } from "../storage/storage.service";
import { PdfService } from "../pdf/pdf.service";
import { AuditService } from "../audit/audit.service";
import { Preparation } from "../signing/signing.service";
import { hmac, canonical, sha256 } from "../../common/crypto";
import { secret } from "../../config/env";
@Injectable()
export class JobsService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(DocumentsRepository) private repo: DocumentsRepository,
    @Inject(FilesService) private files: FilesService,
    @Inject(ObjectStorage) private storage: ObjectStorage,
    @Inject(PdfService) private pdf: PdfService,
    @Inject(AuditService) private audit: AuditService,
  ) {}
  async runOne(signatureId?: string) {
    await this.repo.expire();
    const lease = randomUUID();
    const job = await this.db.transaction(async (tx) => {
      const row = (
        await tx.query<{ id: string; signature_id: string; attempts: number }>(
          `SELECT id,signature_id,attempts FROM processing_jobs WHERE ($1::uuid IS NULL OR signature_id=$1) AND status!='done' AND attempts<5 AND next_run_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
          [signatureId || null],
        )
      ).rows[0];
      if (!row) return null;
      await tx.query(
        "UPDATE processing_jobs SET status='running',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '3 minutes',updated_at=now() WHERE id=$1",
        [row.id, lease],
      );
      await tx.query(
        "UPDATE signature_requests SET status='processing' WHERE id=(SELECT request_id FROM signatures WHERE id=$1) AND status='failed'",
        [row.signature_id],
      );
      return row;
    });
    if (!job) return { processed: false };
    try {
      const sig = (
          await this.db.query("SELECT * FROM signatures WHERE id=$1", [
            job.signature_id,
          ])
        ).rows[0],
        r = await this.repo.get(String(sig.request_id));
      const p = (
        await this.db.query<Preparation>(
          "SELECT * FROM signing_preparations WHERE id=$1",
          [sig.preparation_id],
        )
      ).rows[0];
      const original = await this.files.get(r.original_file_id),
        presented = await this.files.get(r.presented_file_id),
        signedAt = new Date().toISOString();
      const final = await this.pdf.fill(
        await this.files.bytes(presented.id),
        r.fields.filter((f) => f.actor === "signer"),
        p.payload.values,
        p.payload.signature,
        {
          Solicitação: r.id,
          Transação: job.signature_id,
          "Nome declarado": sig.name,
          "Data do aceite": new Date(
            sig.accepted_at as string | Date,
          ).toISOString(),
          "Data da geração": signedAt,
          "Hash original": original.sha256,
          "Hash apresentado": presented.sha256,
          Declaração: sig.consent_text,
          "Versão da declaração": sig.consent_version,
        },
      );
      const signatureBytes = Buffer.from(
        p.payload.signature.split(",")[1],
        "base64",
      );
      const finalId = randomUUID(),
        imageId = randomUUID(),
        evidenceId = randomUUID();
      const base = `signatures/${job.signature_id}/${lease}`;
      const finalKey = `${base}/signed.pdf`,
        imageKey = `${base}/signature.png`,
        evidenceKey = `${base}/evidence.json`;
      const events = (
        await this.db.query(
          "SELECT id,sequence,action,data,previous_hash,hash,created_at FROM audit_events WHERE aggregate_id=$1 ORDER BY sequence",
          [r.id],
        )
      ).rows;
      const manifest = {
        schemaVersion: 1,
        requestId: r.id,
        documentId: r.document_id,
        documentVersionId: r.document_version_id,
        transactionId: job.signature_id,
        declaredName: sig.name,
        declaredCpf: sig.cpf,
        openedAt: r.opened_at,
        acceptedAt: sig.accepted_at,
        signedAt,
        ip: sig.ip,
        userAgent: sig.user_agent,
        consentText: sig.consent_text,
        consentVersion: sig.consent_version,
        originalHash: original.sha256,
        presentedHash: presented.sha256,
        finalHash: sha256(final),
        signatureHash: sha256(signatureBytes),
        fieldValues: p.payload.values,
        events,
        notice:
          "Identificação declarada; não comprova identidade civil e não constitui assinatura ICP-Brasil.",
      };
      const mac = hmac(secret("EVIDENCE_SECRET"), manifest),
        evidence = Buffer.from(canonical({ manifest, hmac: mac }));
      await this.storage.put(finalKey, final, "application/pdf");
      await this.storage.put(imageKey, signatureBytes, "image/png");
      await this.storage.put(evidenceKey, evidence, "application/json");
      await this.db.transaction(async (tx) => {
        const locked = (
          await tx.query(
            "SELECT lease_token FROM processing_jobs WHERE id=$1 FOR UPDATE",
            [job.id],
          )
        ).rows[0];
        if (locked.lease_token !== lease) throw new Error("Lease perdida");
        const request = await this.repo.get(r.id, tx, true);
        if (request.status !== "processing")
          throw new Error("Estado inesperado");
        await this.files.register(
          tx,
          finalId,
          finalKey,
          final,
          "signed",
          (await PDFDocument.load(final)).getPageCount(),
        );
        await this.files.register(
          tx,
          imageId,
          imageKey,
          signatureBytes,
          "signature",
        );
        await this.files.register(
          tx,
          evidenceId,
          evidenceKey,
          evidence,
          "evidence",
        );
        await tx.query(
          "INSERT INTO evidence_packages(signature_id,file_id,manifest,hmac) VALUES($1,$2,$3,$4)",
          [job.signature_id, evidenceId, JSON.stringify(manifest), mac],
        );
        await tx.query(
          "UPDATE signatures SET final_file_id=$2,signature_file_id=$3,signed_at=$4 WHERE id=$1",
          [job.signature_id, finalId, imageId, signedAt],
        );
        await tx.query(
          "UPDATE signature_requests SET status='signed',updated_at=now() WHERE id=$1",
          [r.id],
        );
        await tx.query(
          "UPDATE processing_jobs SET status='done',lease_until=NULL,error=NULL,updated_at=now() WHERE id=$1",
          [job.id],
        );
        await tx.query(
          "UPDATE signing_preparations SET payload=$2 WHERE request_id=$1",
          [
            r.id,
            JSON.stringify({
              name: p.payload.name,
              cpf: p.payload.cpf,
              values: p.payload.values,
              signature: "persisted",
            }),
          ],
        );
        await this.audit.append(tx, "signing.completed", r.id, null, {
          signatureId: job.signature_id,
          finalHash: sha256(final),
          evidenceHash: sha256(evidence),
        });
      });
      return { processed: true, status: "signed" };
    } catch {
      await this.db.transaction(async (tx) => {
        const updated = (
          await tx.query(
            "UPDATE processing_jobs SET status='failed',lease_until=NULL,error='Falha no processamento ou persistência',next_run_at=now()+interval '30 seconds',updated_at=now() WHERE id=$1 AND lease_token=$2 RETURNING signature_id",
            [job.id, lease],
          )
        ).rows[0];
        if (updated) {
          const sig = (
            await tx.query("SELECT request_id FROM signatures WHERE id=$1", [
              job.signature_id,
            ])
          ).rows[0];
          await tx.query(
            "UPDATE signature_requests SET status='failed',updated_at=now() WHERE id=$1 AND status='processing'",
            [sig.request_id],
          );
          await this.audit.append(
            tx,
            "signing.processing_failed",
            String(sig.request_id),
            null,
            { jobId: job.id, attempt: job.attempts + 1 },
          );
        }
      });
      return { processed: true, status: "failed" };
    }
  }
  async retry(requestId: string, actor: string) {
    const signatureId = await this.db.transaction(async (tx) => {
      const r = await this.repo.get(requestId, tx, true);
      if (r.status !== "failed")
        throw new ConflictException("Solicitação não apresenta falha");
      await tx.query(
        "UPDATE processing_jobs SET attempts=0,next_run_at=now(),lease_until=NULL,status='pending' WHERE signature_id=(SELECT id FROM signatures WHERE request_id=$1)",
        [requestId],
      );
      await this.audit.append(tx, "jobs.retry_requested", requestId, actor);
      return String(
        (
          await tx.query("SELECT id FROM signatures WHERE request_id=$1", [
            requestId,
          ])
        ).rows[0].id,
      );
    });
    return this.runOne(signatureId);
  }
}
