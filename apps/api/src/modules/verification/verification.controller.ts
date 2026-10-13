import {
  Inject,
  Controller,
  Post,
  Get,
  Body,
  UploadedFile,
  UseInterceptors,
  Query,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";
import { Database } from "../../database/database";
import { Public, Require } from "../../common/auth.guard";
import { sha256 } from "../../common/crypto";
import { PdfService } from "../pdf/pdf.service";
import { configEnv } from "../../config/env";
import { AuditService } from "../audit/audit.service";
import { page } from "../clients/clients.controller";
@Controller()
export class VerificationController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(PdfService) private pdf: PdfService,
    @Inject(AuditService) private audit: AuditService,
  ) {}
  @Public()
  @Post("verification/check")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: configEnv.maxBytes, files: 1 },
    }),
  )
  async verify(
    @Body() body: unknown,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const b = z.object({ id: z.uuid() }).parse(body);
    if (file) await this.pdf.inspect(file.buffer);
    const hash = file ? sha256(file.buffer) : null;
    const r = (
      await this.db.query(
        "SELECT r.status,f.sha256 FROM signature_requests r JOIN signatures s ON s.request_id=r.id JOIN document_files f ON f.id=s.final_file_id WHERE r.id=$1 AND s.signed_at IS NOT NULL",
        [b.id],
      )
    ).rows[0];
    return {
      registered: Boolean(r),
      matches: hash && r ? hash === r.sha256 : null,
      hash,
      notice:
        "Esta consulta verifica registro e integridade. Não comprova identidade civil nem certificação jurídica.",
    };
  }
  @Require("audit.read") @Get("audit/events") async events(
    @Query("page") p = "1",
    @Query("action") action = "",
  ) {
    return {
      items: (
        await this.db.query(
          "SELECT e.*,u.name AS actor_name FROM audit_events e LEFT JOIN users u ON u.id=e.actor_id WHERE action ILIKE $1 ORDER BY sequence DESC LIMIT 50 OFFSET $2",
          [`%${action.slice(0, 100)}%`, (page(p) - 1) * 50],
        )
      ).rows,
      total: (
        await this.db.query(
          "SELECT count(*)::int total FROM audit_events WHERE action ILIKE $1",
          [`%${action}%`],
        )
      ).rows[0].total,
    };
  }
  @Require("audit.read") @Get("audit/integrity") integrity() {
    return this.audit.verify(this.db);
  }
}
