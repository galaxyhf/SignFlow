import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { templateSchema, Field } from "@signflow/shared";
import { Database } from "../../database/database";
import { FilesService } from "../documents/files.service";
import { AuditService } from "../audit/audit.service";
export type TemplateVersion = Record<string, unknown> & {
  id: string;
  file_id: string;
  fields: Field[];
  version: number;
  template_id: string;
};
@Injectable()
export class TemplatesService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(FilesService) private files: FilesService,
    @Inject(AuditService) private audit: AuditService,
  ) {}
  async list(search: string, p: number) {
    const items = (
      await this.db.query(
        "SELECT t.*,v.id as version_id,v.version,v.file_id FROM document_templates t JOIN LATERAL (SELECT * FROM template_versions WHERE template_id=t.id ORDER BY version DESC LIMIT 1) v ON true WHERE t.active=true AND t.name ILIKE $1 ORDER BY t.updated_at DESC LIMIT 20 OFFSET $2",
        [`%${search}%`, (p - 1) * 20],
      )
    ).rows;
    const total = (
      await this.db.query(
        "SELECT count(*)::int total FROM document_templates WHERE active=true AND name ILIKE $1",
        [`%${search}%`],
      )
    ).rows[0].total;
    return { items, total, page: p };
  }
  async get(id: string) {
    const t = (
      await this.db.query("SELECT * FROM document_templates WHERE id=$1", [id])
    ).rows[0];
    if (!t) throw new NotFoundException("Modelo não encontrado");
    const versions = (
      await this.db.query<TemplateVersion>(
        "SELECT * FROM template_versions WHERE template_id=$1 ORDER BY version DESC",
        [id],
      )
    ).rows;
    return { ...t, versions };
  }
  async version(id: string) {
    const v = (
      await this.db.query<TemplateVersion>(
        "SELECT * FROM template_versions WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (!v) throw new NotFoundException("Versão não encontrada");
    return v;
  }
  async publish(input: unknown, actor: string, id?: string) {
    const b = templateSchema.parse(input),
      file = await this.files.get(b.fileId);
    if (file.kind !== "original")
      throw new BadRequestException("Selecione um PDF original");
    if (b.fields.some((f) => f.page >= file.pages))
      throw new BadRequestException("Campo fora das páginas do PDF");
    if (!b.fields.some((f) => f.type === "signature"))
      throw new BadRequestException(
        "Adicione pelo menos um campo de assinatura",
      );
    return this.db.transaction(async (tx) => {
      let templateId = id;
      if (id) {
        const row = (
          await tx.query(
            "SELECT id FROM document_templates WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!row) throw new NotFoundException();
        await tx.query(
          "UPDATE document_templates SET name=$2,description=$3,updated_at=now() WHERE id=$1",
          [id, b.name, b.description],
        );
      } else {
        templateId = String(
          (
            await tx.query(
              "INSERT INTO document_templates(name,description,created_by,active) VALUES($1,$2,$3,$4) RETURNING id",
              [b.name, b.description, actor, !b.standalone],
            )
          ).rows[0].id,
        );
      }
      const version = Number(
        (
          await tx.query(
            "SELECT COALESCE(max(version),0)+1 AS v FROM template_versions WHERE template_id=$1",
            [templateId],
          )
        ).rows[0].v,
      );
      const v = (
        await tx.query<TemplateVersion>(
          "INSERT INTO template_versions(template_id,version,file_id,fields,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
          [templateId, version, b.fileId, JSON.stringify(b.fields), actor],
        )
      ).rows[0];
      for (const f of b.fields)
        await tx.query(
          "INSERT INTO template_fields(version_id,field_id,definition) VALUES($1,$2,$3)",
          [v.id, f.id, JSON.stringify(f)],
        );
      await this.audit.append(
        tx,
        "templates.published",
        String(templateId),
        actor,
        { version, versionId: v.id },
      );
      return { id: templateId, version: v };
    });
  }
}
