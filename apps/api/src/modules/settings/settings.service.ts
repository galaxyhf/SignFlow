import { Inject, Injectable } from "@nestjs/common";
import { defaultSettings, settingsSchema } from "@signflow/shared";
import { Database } from "../../database/database";
import { AuditService } from "../audit/audit.service";
import { sha256 } from "../../common/crypto";
@Injectable()
export class SettingsService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(AuditService) private audit: AuditService,
  ) {}
  async get() {
    const r = (
      await this.db.query("SELECT value FROM app_settings WHERE key=$1", [
        "general",
      ])
    ).rows[0];
    return settingsSchema.parse(r?.value ?? defaultSettings);
  }
  async consent() {
    const s = await this.get();
    return { text: s.consentText, version: sha256(s.consentText) };
  }
  async save(input: unknown, actor: string) {
    const s = settingsSchema.parse(input);
    await this.db.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO app_settings(key,value,updated_by) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET value=$2,updated_by=$3,updated_at=now()",
        ["general", JSON.stringify(s), actor],
      );
      await this.audit.append(tx, "settings.updated", null, actor, {
        consentVersion: sha256(s.consentText),
      });
    });
    return s;
  }
}
