import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Database, Queryable } from "../../database/database";
import { ObjectStorage } from "../storage/storage.service";
import { PdfService } from "../pdf/pdf.service";
import { AuditService } from "../audit/audit.service";
import { SettingsService } from "../settings/settings.service";
import { configEnv } from "../../config/env";
import { sha256 } from "../../common/crypto";
export type StoredFile = Record<string, unknown> & {
  id: string;
  key: string;
  sha256: string;
  pages: number;
  kind: string;
};
@Injectable()
export class FilesService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(ObjectStorage) private storage: ObjectStorage,
    @Inject(PdfService) private pdf: PdfService,
    @Inject(AuditService) private audit: AuditService,
    @Inject(SettingsService) private settings: SettingsService,
  ) {}
  async upload(bytes: Uint8Array, actor: string) {
    const s = await this.settings.get();
    const info = await this.pdf.inspect(
      bytes,
      Math.min(s.uploadMb * 1024 * 1024, configEnv.maxBytes),
      Math.min(s.maxPages, configEnv.maxPages),
    );
    const id = randomUUID(),
      key = `originals/${id}.pdf`;
    await this.storage.put(key, bytes, "application/pdf");
    return this.db.transaction(async (tx) => {
      const f = await this.register(
        tx,
        id,
        key,
        bytes,
        "original",
        info.pages,
        actor,
      );
      await this.audit.append(tx, "files.uploaded", id, actor, {
        hash: f.sha256,
        pages: info.pages,
      });
      return f;
    });
  }
  async register(
    tx: Queryable,
    id: string,
    key: string,
    bytes: Uint8Array,
    kind: string,
    pages = 0,
    owner: string | null = null,
  ) {
    return (
      await tx.query<StoredFile>(
        "INSERT INTO document_files(id,key,kind,sha256,bytes,pages,owner_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [id, key, kind, sha256(bytes), bytes.length, pages, owner],
      )
    ).rows[0];
  }
  async get(id: string) {
    const f = (
      await this.db.query<StoredFile>(
        "SELECT * FROM document_files WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (!f) throw new NotFoundException("Arquivo não encontrado");
    return f;
  }
  async bytes(id: string) {
    const f = await this.get(id);
    const bytes = await this.storage.get(f.key);
    if (sha256(bytes) !== f.sha256)
      throw new BadRequestException(
        "Falha na verificação de integridade do arquivo",
      );
    return bytes;
  }
}
