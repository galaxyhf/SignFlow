import {
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  requestSchema,
  validateValues,
  canTransition,
  State,
} from "@signflow/shared";
import { Database } from "../../database/database";
import { DocumentsRepository } from "./documents.repository";
import { TemplatesService } from "../templates/templates.service";
import { FilesService } from "./files.service";
import { ObjectStorage } from "../storage/storage.service";
import { PdfService } from "../pdf/pdf.service";
import { AuditService } from "../audit/audit.service";
import { SettingsService } from "../settings/settings.service";
import { token, sha256 } from "../../common/crypto";
import { configEnv } from "../../config/env";
@Injectable()
export class DocumentsService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(DocumentsRepository) private repo: DocumentsRepository,
    @Inject(TemplatesService) private templates: TemplatesService,
    @Inject(FilesService) private files: FilesService,
    @Inject(ObjectStorage) private storage: ObjectStorage,
    @Inject(PdfService) private pdf: PdfService,
    @Inject(AuditService) private audit: AuditService,
    @Inject(SettingsService) private settings: SettingsService,
  ) {}
  async create(input: unknown, actor: string) {
    const b = requestSchema.parse(input);
    if (
      Date.parse(b.expiresAt) <= Date.now() ||
      Date.parse(b.expiresAt) > Date.now() + 90 * 86400000
    )
      throw new BadRequestException("Prazo deve estar entre agora e 90 dias");
    const v = await this.templates.version(b.templateVersionId);
    try {
      validateValues(v.fields, b.internalValues, "employee");
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const c = (
      await this.db.query(
        "SELECT id FROM clients WHERE id=$1 AND active=true",
        [b.clientId],
      )
    ).rows[0];
    if (!c) throw new BadRequestException("Cliente inativo ou inexistente");
    const responsible = b.responsibleId || actor;
    if (
      !(
        await this.db.query(
          "SELECT id FROM users WHERE id=$1 AND active=true",
          [responsible],
        )
      ).rows[0]
    )
      throw new BadRequestException("Responsável inválido");
    const original = await this.files.bytes(v.file_id),
      presented = await this.pdf.fill(
        original,
        v.fields.filter((f) => f.actor === "employee"),
        b.internalValues,
      );
    const id = randomUUID(),
      fileId = randomUUID(),
      key = `presented/${fileId}.pdf`,
      accessToken = token(),
      consent = await this.settings.consent();
    await this.storage.put(key, presented, "application/pdf");
    return this.db.transaction(async (tx) => {
      await this.files.register(
        tx,
        fileId,
        key,
        presented,
        "presented",
        (await this.files.get(v.file_id)).pages,
        actor,
      );
      const d = (
        await tx.query<{ id: string }>(
          "INSERT INTO documents(title,client_id,created_by,responsible_id,description,ticket,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
          [
            b.title,
            b.clientId,
            actor,
            responsible,
            b.description,
            b.ticket,
            b.notes,
          ],
        )
      ).rows[0];
      const version = (
        await tx.query<{ id: string }>(
          "INSERT INTO document_versions(document_id,template_version_id,original_file_id,presented_file_id,fields,internal_values) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
          [
            d.id,
            v.id,
            v.file_id,
            fileId,
            JSON.stringify(v.fields),
            JSON.stringify(b.internalValues),
          ],
        )
      ).rows[0];
      await tx.query(
        "INSERT INTO signature_requests(id,document_version_id,token_hash,expires_at,consent_text,consent_version) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          version.id,
          sha256(accessToken),
          b.expiresAt,
          consent.text,
          consent.version,
        ],
      );
      await tx.query(
        "INSERT INTO signers(request_id,expected_name,expected_cpf) VALUES($1,$2,$3)",
        [id, b.expectedName, b.expectedCpf],
      );
      await this.audit.append(tx, "request.created", id, actor, {
        versionId: version.id,
        presentedHash: sha256(presented),
      });
      return { id, link: `${configEnv.origin}/assinar/${accessToken}` };
    });
  }
  async details(id: string) {
    await this.repo.expire();
    const r = await this.repo.get(id);
    const [history, reviews, signature] = await Promise.all([
      this.db.query(
        "SELECT e.*,u.name AS actor_name FROM audit_events e LEFT JOIN users u ON u.id=e.actor_id WHERE aggregate_id=$1 ORDER BY sequence",
        [id],
      ),
      this.db.query(
        "SELECT r.*,u.name as reviewer_name FROM identity_reviews r JOIN users u ON u.id=r.reviewer_id WHERE request_id=$1 ORDER BY created_at DESC",
        [id],
      ),
      this.db.query(
        "SELECT id,name,cpf,accepted_at,signed_at,ip,user_agent,consent_text,consent_version,final_file_id,signature_file_id FROM signatures WHERE request_id=$1",
        [id],
      ),
    ]);
    const evidence = signature.rows[0]
      ? (
          await this.db.query(
            "SELECT * FROM evidence_packages WHERE signature_id=$1",
            [signature.rows[0].id],
          )
        ).rows[0]
      : null;
    const { token_hash: _token, ...safe } = r;
    return {
      ...safe,
      history: history.rows,
      reviews: reviews.rows,
      signature: signature.rows[0] ?? null,
      evidence,
    };
  }
  async action(
    id: string,
    action: "cancel" | "revoke" | "renew",
    actor: string,
    expiresAt?: string,
  ) {
    const accessToken = token();
    return this.db.transaction(async (tx) => {
      const r = await this.repo.get(id, tx, true);
      if (action === "renew") {
        if (!["pending", "viewed", "filling", "expired"].includes(r.status))
          throw new ConflictException(
            "Não é possível renovar esta solicitação",
          );
        if (
          !expiresAt ||
          Date.parse(expiresAt) <= Date.now() ||
          Date.parse(expiresAt) > Date.now() + 90 * 86400000
        )
          throw new BadRequestException("Prazo inválido");
        await tx.query(
          "UPDATE signature_requests SET token_hash=$2,expires_at=$3,revoked_at=NULL,status='pending',updated_at=now() WHERE id=$1",
          [id, sha256(accessToken), expiresAt],
        );
        await this.audit.append(tx, "request.link_rotated", id, actor);
        return { link: `${configEnv.origin}/assinar/${accessToken}` };
      }
      const next: State = "cancelled";
      if (!canTransition(r.status, next))
        throw new ConflictException("Estado não permite cancelamento");
      await tx.query(
        "UPDATE signature_requests SET status=$2,revoked_at=now(),updated_at=now() WHERE id=$1",
        [id, next],
      );
      await this.audit.append(tx, `request.${action}`, id, actor, {
        from: r.status,
        to: next,
      });
      return { success: true };
    });
  }
}
