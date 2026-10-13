import { Inject, Controller, Get, Put, Body, Req } from "@nestjs/common";
import { Require, AuthRequest } from "../../common/auth.guard";
import { SettingsService } from "./settings.service";
@Controller("settings")
export class SettingsController {
  constructor(@Inject(SettingsService) private settings: SettingsService) {}
  @Get() get() {
    return this.settings.get();
  }
  @Require("settings.write") @Put() save(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.settings.save(body, req.actor.id);
  }
}
