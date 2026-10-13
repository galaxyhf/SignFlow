import { ApiInput } from "../../common/openapi";
import { templateSchema } from "@signflow/shared";
import {
  Inject,
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import { fieldsSchema } from "@signflow/shared";
import { FilesService } from "../documents/files.service";
import { PdfService } from "../pdf/pdf.service";
import { sendPdf } from "../signing/signing.controller";
import { TemplatesService } from "./templates.service";
import { Require, AuthRequest } from "../../common/auth.guard";
import { uuid, page } from "../clients/clients.controller";
@Controller("templates")
export class TemplatesController {
  constructor(
    @Inject(TemplatesService) private templates: TemplatesService,
    @Inject(FilesService) private files: FilesService,
    @Inject(PdfService) private pdf: PdfService,
  ) {}
  @Post("preview") async preview(@Body() body: unknown, @Res() res: Response) {
    const b = z
      .object({
        fileId: z.uuid(),
        fields: fieldsSchema,
        values: z
          .record(z.string(), z.union([z.string().max(4000), z.boolean()]))
          .default({}),
      })
      .parse(body);
    const file = await this.files.get(b.fileId);
    if (b.fields.some((f) => f.page >= file.pages))
      throw new BadRequestException("Página inválida");
    sendPdf(
      res,
      await this.pdf.fill(await this.files.bytes(b.fileId), b.fields, b.values),
    );
  }
  @Get() list(@Query("search") search = "", @Query("page") p = "1") {
    return this.templates.list(search.slice(0, 200), page(p));
  }
  @Get(":id") get(@Param("id") id: string) {
    return this.templates.get(uuid(id));
  }
  @Require("templates.write") @Post() @ApiInput(templateSchema) create(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.templates.publish(body, req.actor.id);
  }
  @Require("templates.write") @Post(":id/versions") publish(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.templates.publish(body, req.actor.id, uuid(id));
  }
}
