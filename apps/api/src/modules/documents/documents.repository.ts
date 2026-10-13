import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Field, State } from "@signflow/shared";
import { AuditService } from "../audit/audit.service";
import { Database, Queryable } from "../../database/database";
export type RequestRecord = Record<string, unknown> & {
  id: string;
  document_id: string;
  document_version_id: string;
  status: State;
  expires_at: Date;
  revoked_at: Date | null;
  fields: Field[];
  internal_values: Record<string, string | boolean>;
  original_file_id: string;
  presented_file_id: string;
  consent_text: string;
  consent_version: string;
  client_id: string;
  title: string;
  expected_name: string;
  expected_cpf: string;
  opened_at: Date | null;
};
export const requestSelect = `SELECT r.*,v.document_id,v.template_version_id,v.original_file_id,v.presented_file_id,v.fields,v.internal_values,d.title,d.client_id,d.ticket,d.description,d.notes,d.created_by,d.responsible_id,c.name AS client_name,c.tax_id,c.whatsapp,c.internal_code,s.expected_name,s.expected_cpf FROM signature_requests r JOIN document_versions v ON v.id=r.document_version_id JOIN documents d ON d.id=v.document_id JOIN clients c ON c.id=d.client_id JOIN signers s ON s.request_id=r.id`;
@Injectable()
export class DocumentsRepository {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(AuditService) private audit: AuditService,
  ) {}
  async get(id: string, tx: Queryable = this.db, lock = false) {
    const r = (
      await tx.query<RequestRecord>(
        `${requestSelect} WHERE r.id=$1 ${lock ? "FOR UPDATE OF r" : ""}`,
        [id],
      )
    ).rows[0];
    if (!r) throw new NotFoundException("Solicitação não encontrada");
    return r;
  }
  async byHash(hash: string, tx: Queryable = this.db, lock = false) {
    const r = (
      await tx.query<RequestRecord>(
        `${requestSelect} WHERE r.token_hash=$1 ${lock ? "FOR UPDATE OF r" : ""}`,
        [hash],
      )
    ).rows[0];
    if (!r) throw new NotFoundException("Link inválido ou indisponível");
    return r;
  }
  async expire() {
    await this.db.transaction(async (tx) => {
      const rows = (
        await tx.query(
          "SELECT id,status FROM signature_requests WHERE status IN ('pending','viewed','filling') AND expires_at<=now() ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT 100",
        )
      ).rows;
      for (const r of rows) {
        await tx.query(
          "UPDATE signature_requests SET status='expired',updated_at=now() WHERE id=$1",
          [r.id],
        );
        await this.audit.append(tx, "request.expired", String(r.id), null, {
          from: r.status,
          to: "expired",
        });
      }
    });
  }
  async list(q: {
    search: string;
    status: string;
    client: string;
    responsible: string;
    from: string;
    to: string;
    page: number;
  }) {
    await this.expire();
    const params = [
      `%${q.search}%`,
      q.status || null,
      q.client || null,
      q.responsible || null,
      q.from || null,
      q.to || null,
    ];
    const where = ` WHERE (d.title ILIKE $1 OR d.ticket ILIKE $1 OR c.name ILIKE $1) AND ($2::text IS NULL OR r.status=$2) AND ($3::uuid IS NULL OR d.client_id=$3) AND ($4::uuid IS NULL OR d.responsible_id=$4) AND ($5::timestamptz IS NULL OR r.created_at >= $5) AND ($6::timestamptz IS NULL OR r.created_at < $6::timestamptz+interval '1 day')`;
    const all = requestSelect + where;
    const total = (
      await this.db.query(`SELECT count(*)::int total FROM (${all}) q`, params)
    ).rows[0].total;
    const items = (
      await this.db.query<RequestRecord>(
        `${all} ORDER BY r.created_at DESC LIMIT 20 OFFSET $7`,
        [...params, (q.page - 1) * 20],
      )
    ).rows;
    return {
      items: items.map(({ token_hash: _token, ...r }) => r),
      total,
      page: q.page,
    };
  }
}
