import {
  Inject,
  Injectable,
  GoneException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { prepareSchema, confirmSchema, validateValues } from "@signflow/shared";
import { Database, Queryable } from "../../database/database";
import {
  DocumentsRepository,
  RequestRecord,
} from "../documents/documents.repository";
import { FilesService } from "../documents/files.service";
import { PdfService } from "../pdf/pdf.service";
import { AuditService } from "../audit/audit.service";
import { SettingsService } from "../settings/settings.service";
import { sha256 } from "../../common/crypto";
export type Preparation = Record<string, unknown> & {
  id: string;
  request_id: string;
  payload: ReturnType<typeof prepareSchema.parse>;
  presented_hash: string;
  consent_version: string;
  expires_at: Date;
};
@Injectable()
export class SigningService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(DocumentsRepository) private repo: DocumentsRepository,
    @Inject(FilesService) private files: FilesService,
    @Inject(PdfService) private pdf: PdfService,
    @Inject(AuditService) private audit: AuditService,
    @Inject(SettingsService) private settings: SettingsService,
  ) {}
  async access(
    token: string,
    tx: Queryable = this.db,
    lock = false,
    completed = false,
  ) {
    if (!/^[\w-]{43}$/.test(token)) throw new GoneException("Link inválido");
    const r = await this.repo.byHash(sha256(token), tx, lock);
    if (r.revoked_at) throw new GoneException("Link revogado");
    if (completed && ["signed", "reviewed", "divergent"].includes(r.status)) {
      const signed = (
        await tx.query("SELECT signed_at FROM signatures WHERE request_id=$1", [
          r.id,
        ])
      ).rows[0];
      if (
        signed &&
        Date.now() - new Date(signed.signed_at as string | Date).getTime() <
          48 * 3600000
      )
        return r;
      throw new GoneException("Prazo de download expirado");
    }
    if (new Date(r.expires_at).getTime() <= Date.now())
      throw new GoneException("Link expirado");
    if (["cancelled", "refused", "expired"].includes(r.status))
      throw new GoneException("Solicitação indisponível");
    return r;
  }
  async open(token: string) {
    return this.db.transaction(async (tx) => {
      const r = await this.access(token, tx, true, true);
      if (r.status === "pending") {
        await tx.query(
          "UPDATE signature_requests SET status='viewed',opened_at=COALESCE(opened_at,now()),updated_at=now() WHERE id=$1",
          [r.id],
        );
        await this.audit.append(tx, "signing.opened", r.id, null);
        r.status = "viewed";
      }
      const settings = await this.settings.get();
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        expiresAt: r.expires_at,
        status: r.status,
        fields: r.fields.filter((f) => f.actor === "signer"),
        companyName: settings.companyName,
        logoUrl: settings.logoUrl,
        consentText: r.consent_text,
        consentVersion: r.consent_version,
      };
    });
  }
  async prepare(token: string, input: unknown) {
    const body = prepareSchema.parse(input);
    await this.pdf.validateSignature(body.signature);
    return this.db.transaction(async (tx) => {
      const r = await this.access(token, tx, true);
      if (!["pending", "viewed", "filling"].includes(r.status))
        throw new ConflictException(
          "Documento não está disponível para preenchimento",
        );
      try {
        validateValues(r.fields, body.values, "signer");
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
      await this.pdf.validateText(body.name + body.cpf + r.consent_text);
      const id = randomUUID(),
        file = await this.files.get(r.presented_file_id);
      await this.pdf.fill(
        await this.files.bytes(file.id),
        r.fields.filter((f) => f.actor === "signer"),
        body.values,
        body.signature,
      );
      await tx.query(
        "INSERT INTO signing_preparations(id,request_id,payload,presented_hash,consent_version,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '30 minutes')",
        [id, r.id, JSON.stringify(body), file.sha256, r.consent_version],
      );
      await tx.query(
        "UPDATE signature_requests SET status='filling',updated_at=now() WHERE id=$1",
        [r.id],
      );
      await this.audit.append(tx, "signing.prepared", r.id, null, {
        preparationId: id,
        presentedHash: file.sha256,
      });
      return { preparationId: id, consentVersion: r.consent_version };
    });
  }
  async preview(token: string, id: string) {
    const r = await this.access(token),
      p = (
        await this.db.query<Preparation>(
          "SELECT * FROM signing_preparations WHERE id=$1 AND request_id=$2 AND expires_at>now()",
          [id, r.id],
        )
      ).rows[0];
    if (!p) throw new GoneException("Revisão expirada");
    return this.pdf.fill(
      await this.files.bytes(r.presented_file_id),
      r.fields.filter((f) => f.actor === "signer"),
      p.payload.values,
      p.payload.signature,
    );
  }
  async confirm(token: string, input: unknown, ip: string, userAgent: string) {
    const body = confirmSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const r = await this.access(token, tx, true, true);
      const existing = (
        await tx.query(
          "SELECT id,idempotency_key FROM signatures WHERE request_id=$1",
          [r.id],
        )
      ).rows[0];
      if (existing) {
        if (existing.idempotency_key !== body.idempotencyKey)
          throw new ConflictException(
            "Este documento já recebeu uma assinatura",
          );
        return { id: existing.id, status: r.status };
      }
      if (!["pending", "viewed", "filling"].includes(r.status))
        throw new ConflictException("Estado não permite assinatura");
      const p = (
        await tx.query<Preparation>(
          "SELECT * FROM signing_preparations WHERE id=$1 AND request_id=$2 AND expires_at>now()",
          [body.preparationId, r.id],
        )
      ).rows[0];
      if (
        !p ||
        p.consent_version !== body.consentVersion ||
        r.consent_version !== body.consentVersion
      )
        throw new GoneException("Revisão inválida ou expirada");
      const file = await this.files.get(r.presented_file_id);
      if (file.sha256 !== p.presented_hash)
        throw new ConflictException("Documento alterado");
      try {
        validateValues(r.fields, p.payload.values, "signer");
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
      const id = randomUUID();
      await tx.query(
        "INSERT INTO signatures(id,request_id,preparation_id,idempotency_key,name,cpf,accepted_at,ip,user_agent,consent_text,consent_version) VALUES($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10)",
        [
          id,
          r.id,
          p.id,
          body.idempotencyKey,
          p.payload.name,
          p.payload.cpf,
          ip,
          userAgent.slice(0, 512),
          r.consent_text,
          r.consent_version,
        ],
      );
      for (const [fieldId, value] of Object.entries(p.payload.values))
        await tx.query(
          "INSERT INTO signature_field_values(signature_id,field_id,value) VALUES($1,$2,$3)",
          [id, fieldId, JSON.stringify(value)],
        );
      await tx.query(
        "UPDATE signature_requests SET status='processing',updated_at=now() WHERE id=$1",
        [r.id],
      );
      await tx.query("INSERT INTO processing_jobs(signature_id) VALUES($1)", [
        id,
      ]);
      await this.audit.append(tx, "signing.accepted", r.id, null, {
        signatureId: id,
        preparationId: p.id,
        presentedHash: p.presented_hash,
        consentVersion: r.consent_version,
      });
      return { id, status: "processing" };
    });
  }
  async file(token: string, kind: string) {
    const r = await this.access(token, this.db, false, true);
    let id = r.presented_file_id;
    if (kind === "signed") {
      const s = (
        await this.db.query(
          "SELECT final_file_id FROM signatures WHERE request_id=$1 AND signed_at IS NOT NULL",
          [r.id],
        )
      ).rows[0];
      if (!s?.final_file_id)
        throw new ConflictException("PDF ainda está em processamento");
      id = String(s.final_file_id);
    }
    return this.files.bytes(id);
  }
  async refuse(token: string, reason: string) {
    return this.db.transaction(async (tx) => {
      const r = await this.access(token, tx, true);
      if (!["pending", "viewed", "filling"].includes(r.status))
        throw new ConflictException();
      await tx.query(
        "UPDATE signature_requests SET status='refused',revoked_at=now(),updated_at=now() WHERE id=$1",
        [r.id],
      );
      await this.audit.append(tx, "signing.refused", r.id, null, { reason });
      return { success: true };
    });
  }
}
export function publicStatus(r: RequestRecord) {
  return { id: r.id, status: r.status };
}
