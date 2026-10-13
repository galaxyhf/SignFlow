import { ApiInput } from "../../common/openapi";
import { requestSchema } from "@signflow/shared";
import {
  Inject,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { z } from "zod";
import { Database } from "../../database/database";
import { ReviewsService } from "./reviews.service";
import { Require, AuthRequest } from "../../common/auth.guard";
import { DocumentsRepository } from "./documents.repository";
import { DocumentsService } from "./documents.service";
import { FilesService } from "./files.service";
import { JobsService } from "../jobs/jobs.service";
import { uuid, page } from "../clients/clients.controller";
import { sendPdf } from "../signing/signing.controller";
import { configEnv } from "../../config/env";
@Controller()
export class DocumentsController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(DocumentsRepository) private repo: DocumentsRepository,
    @Inject(DocumentsService) private documents: DocumentsService,
    @Inject(FilesService) private files: FilesService,
    @Inject(JobsService) private jobs: JobsService,
    @Inject(ReviewsService) private reviews: ReviewsService,
  ) {}
  @Require("templates.write")
  @Post("files/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: configEnv.maxBytes, files: 1 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File, @Req() req: AuthRequest) {
    if (!file || file.mimetype !== "application/pdf")
      throw new BadRequestException("Selecione um PDF");
    return this.files.upload(file.buffer, req.actor.id);
  }
  @Get("files/:id") async file(
    @Param("id") id: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const f = await this.files.get(uuid(id));
    if (f.kind === "original" && f.owner_id !== req.actor.id) {
      const used = (
        await this.db.query(
          "SELECT id FROM template_versions WHERE file_id=$1",
          [id],
        )
      ).rows[0];
      if (!used) throw new BadRequestException("Arquivo não associado");
    }
    const bytes = await this.files.bytes(id);
    res
      .set({
        "Content-Type":
          f.kind === "evidence"
            ? "application/json"
            : f.kind === "signature"
              ? "image/png"
              : "application/pdf",
        "Content-Disposition": `inline; filename="${f.kind === "evidence" ? "evidencias.json" : f.kind === "signature" ? "assinatura.png" : "documento.pdf"}"`,
        "Cache-Control": "private, no-store",
      })
      .send(Buffer.from(bytes));
  }
  @Get("documents") list(@Query() query: Record<string, string>) {
    return this.repo.list({
      search: (query.search || "").slice(0, 200),
      status: query.status || "",
      client: query.client ? uuid(query.client) : "",
      responsible: query.responsible ? uuid(query.responsible) : "",
      from: query.from ? z.iso.date().parse(query.from) : "",
      to: query.to ? z.iso.date().parse(query.to) : "",
      page: page(query.page),
    });
  }
  @Require("requests.write")
  @Post("signature-requests")
  @ApiInput(requestSchema)
  create(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.documents.create(body, req.actor.id);
  }
  @Get("documents/:id") details(@Param("id") id: string) {
    return this.documents.details(uuid(id));
  }
  @Get("documents/:id/files") async listFiles(@Param("id") id: string) {
    const r = await this.repo.get(uuid(id));
    return {
      original: await this.files.get(r.original_file_id),
      presented: await this.files.get(r.presented_file_id),
    };
  }
  @Get("documents/:id/original") async original(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const r = await this.repo.get(uuid(id));
    sendPdf(res, await this.files.bytes(r.original_file_id), "original.pdf");
  }
  @Require("requests.write") @Post("signature-requests/:id/:action") action(
    @Param("id") id: string,
    @Param("action") action: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    uuid(id);
    if (action === "retry") return this.jobs.retry(id, req.actor.id);
    const a = z.enum(["cancel", "revoke", "renew"]).parse(action);
    const b = z
      .object({ expiresAt: z.iso.datetime({ offset: true }).optional() })
      .parse(body);
    return this.documents.action(id, a, req.actor.id, b.expiresAt);
  }
  @Require("reviews.write") @Post("documents/:id/reviews") async review(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.reviews.record(uuid(id), body, req.actor.id);
  }
}
