import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { clientSchema } from "@signflow/shared";
import { Database } from "../../database/database";
import { AuditService } from "../audit/audit.service";
@Injectable()
export class ClientsService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(AuditService) private audit: AuditService,
  ) {}
  async list(search: string, page: number, active: string, sort: string) {
    const order = sort === "name" ? "name ASC" : "created_at DESC";
    const params = [
      `%${search}%`,
      active === "true" ? true : active === "false" ? false : null,
    ];
    const where =
      "WHERE (name ILIKE $1 OR tax_id ILIKE $1 OR internal_code ILIKE $1) AND ($2::boolean IS NULL OR active=$2)";
    const count = (
      await this.db.query(
        `SELECT count(*)::int AS total FROM clients ${where}`,
        params,
      )
    ).rows[0];
    const rows = (
      await this.db.query(
        `SELECT * FROM clients ${where} ORDER BY ${order} LIMIT 20 OFFSET $3`,
        [...params, (page - 1) * 20],
      )
    ).rows;
    return { items: rows, total: count.total, page };
  }
  async get(id: string) {
    const c = (await this.db.query("SELECT * FROM clients WHERE id=$1", [id]))
      .rows[0];
    if (!c) throw new NotFoundException("Cliente não encontrado");
    return c;
  }
  async save(input: unknown, actor: string, id?: string) {
    const c = clientSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const row = id
        ? (
            await tx.query(
              "UPDATE clients SET name=$2,trade_name=$3,tax_id=$4,phone=$5,whatsapp=$6,internal_code=$7,notes=$8,active=$9,updated_at=now() WHERE id=$1 RETURNING *",
              [
                id,
                c.name,
                c.tradeName,
                c.taxId,
                c.phone,
                c.whatsapp,
                c.internalCode,
                c.notes,
                c.active,
              ],
            )
          ).rows[0]
        : (
            await tx.query(
              "INSERT INTO clients(name,trade_name,tax_id,phone,whatsapp,internal_code,notes,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
              [
                c.name,
                c.tradeName,
                c.taxId,
                c.phone,
                c.whatsapp,
                c.internalCode,
                c.notes,
                c.active,
              ],
            )
          ).rows[0];
      if (!row) throw new NotFoundException();
      await this.audit.append(
        tx,
        id ? "clients.updated" : "clients.created",
        String(row.id),
        actor,
      );
      return row;
    });
  }
}
