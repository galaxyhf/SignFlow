import { Inject, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { Database } from "../../database/database";
import { DocumentsRepository } from "./documents.repository";
@Controller("dashboard")
export class DashboardController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(DocumentsRepository) private repo: DocumentsRepository,
  ) {}
  @Get() async get(@Query() q: Record<string, string>) {
    const from = q.from ? z.iso.date().parse(q.from) : "",
      to = q.to ? z.iso.date().parse(q.to) : "",
      responsible = q.responsible ? z.uuid().parse(q.responsible) : "";
    const recent = await this.repo.list({
      search: "",
      status: "",
      client: "",
      from,
      to,
      responsible,
      page: 1,
    });
    const where = `FROM signature_requests r JOIN document_versions v ON v.id=r.document_version_id JOIN documents d ON d.id=v.document_id WHERE ($1::timestamptz IS NULL OR r.created_at>=$1) AND ($2::timestamptz IS NULL OR r.created_at<$2::timestamptz+interval '1 day') AND ($3::uuid IS NULL OR d.responsible_id=$3)`;
    const params = [from || null, to || null, responsible || null];
    const counts = (
      await this.db.query(
        `SELECT r.status,count(*)::int count ${where} GROUP BY r.status`,
        params,
      )
    ).rows;
    const evolution = (
      await this.db.query(
        `SELECT to_char(date_trunc('day',s.signed_at),'YYYY-MM-DD') AS day,count(*)::int count FROM signatures s JOIN signature_requests r ON r.id=s.request_id JOIN document_versions v ON v.id=r.document_version_id JOIN documents d ON d.id=v.document_id WHERE s.signed_at IS NOT NULL AND ($1::timestamptz IS NULL OR s.signed_at>=$1) AND ($2::timestamptz IS NULL OR s.signed_at<$2::timestamptz+interval '1 day') AND ($3::uuid IS NULL OR d.responsible_id=$3) GROUP BY day ORDER BY day`,
        params,
      )
    ).rows;
    const activities = (
      await this.db.query(
        "SELECT e.action,e.created_at,u.name AS actor_name FROM audit_events e LEFT JOIN users u ON u.id=e.actor_id ORDER BY sequence DESC LIMIT 10",
      )
    ).rows;
    return {
      counts,
      total: counts.reduce((a, r) => a + Number(r.count), 0),
      recent: recent.items.slice(0, 6),
      activities,
      evolution,
    };
  }
}
