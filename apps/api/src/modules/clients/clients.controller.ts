import { ApiInput } from "../../common/openapi";
import { clientSchema } from "@signflow/shared";
import {
  Inject,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import { ClientsService } from "./clients.service";
import { AuthRequest, Require } from "../../common/auth.guard";
export const uuid = (v: string) => z.uuid().parse(v);
export const page = (v?: string) =>
  z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .parse(v || 1);
@Controller("clients")
export class ClientsController {
  constructor(@Inject(ClientsService) private clients: ClientsService) {}
  @Get() list(
    @Query("search") search = "",
    @Query("page") p = "1",
    @Query("active") active = "",
    @Query("sort") sort = "",
  ) {
    return this.clients.list(search.slice(0, 200), page(p), active, sort);
  }
  @Get(":id") get(@Param("id") id: string) {
    return this.clients.get(uuid(id));
  }
  @Require("clients.write") @Post() @ApiInput(clientSchema) create(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.clients.save(body, req.actor.id);
  }
  @Require("clients.write") @Patch(":id") update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.clients.save(body, req.actor.id, uuid(id));
  }
  @Require("clients.write") @Delete(":id") async remove(
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    const c = await this.clients.get(uuid(id));
    return this.clients.save(
      {
        name: c.name,
        tradeName: c.trade_name,
        taxId: c.tax_id,
        phone: c.phone,
        whatsapp: c.whatsapp,
        internalCode: c.internal_code,
        notes: c.notes,
        active: false,
      },
      req.actor.id,
      id,
    );
  }
}
