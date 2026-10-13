import { confirmSchema } from "@signflow/shared";
import { ApiInput } from "../../common/openapi";
import { prepareSchema } from "@signflow/shared";
import {
  Inject,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import { Public, AuthRequest } from "../../common/auth.guard";
import { SigningService } from "./signing.service";
import { JobsService } from "../jobs/jobs.service";
import { uuid } from "../clients/clients.controller";
export function sendPdf(
  res: Response,
  bytes: Uint8Array,
  name = "documento.pdf",
) {
  res
    .set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    })
    .send(Buffer.from(bytes));
}
@Public()
@Controller("public/sign")
export class SigningController {
  constructor(
    @Inject(SigningService) private signing: SigningService,
    @Inject(JobsService) private jobs: JobsService,
  ) {}
  @Get(":token") open(@Param("token") token: string) {
    return this.signing.open(token);
  }
  @Get(":token/pdf") async pdf(
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    sendPdf(res, await this.signing.file(token, "presented"));
  }
  @Get(":token/signed") async signed(
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    sendPdf(res, await this.signing.file(token, "signed"), "assinado.pdf");
  }
  @Post(":token/prepare") @ApiInput(prepareSchema) prepare(
    @Param("token") token: string,
    @Body() body: unknown,
  ) {
    return this.signing.prepare(token, body);
  }
  @Get(":token/preview/:id") async preview(
    @Param("token") token: string,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    sendPdf(res, await this.signing.preview(token, uuid(id)));
  }
  @Post(":token/confirm") @ApiInput(confirmSchema) async confirm(
    @Param("token") token: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const result = await this.signing.confirm(
      token,
      body,
      req.ip || "unknown",
      req.header("user-agent") || "",
    );
    if (result.status === "processing")
      await this.jobs.runOne(String(result.id));
    return { id: result.id };
  }
  @Post(":token/refuse") refuse(
    @Param("token") token: string,
    @Body() body: unknown,
  ) {
    const b = z.object({ reason: z.string().min(5).max(1000) }).parse(body);
    return this.signing.refuse(token, b.reason);
  }
}
