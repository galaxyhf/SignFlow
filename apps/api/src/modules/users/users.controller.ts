import {
  Inject,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
} from "@nestjs/common";
import { Database } from "../../database/database";
import { AuthService } from "../auth/auth.service";
import { UsersService } from "./users.service";
import { Require, AuthRequest } from "../../common/auth.guard";
import { uuid } from "../clients/clients.controller";
@Controller("users")
export class UsersController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(AuthService) private auth: AuthService,
    @Inject(UsersService) private users: UsersService,
  ) {}
  @Get("responsibles") responsibles() {
    return this.db
      .query("SELECT id,name FROM users WHERE active=true ORDER BY name")
      .then((r) => r.rows);
  }
  @Require("users.write") @Get() list() {
    return this.db
      .query(
        "SELECT u.id,u.name,u.login,u.active,u.created_at,r.role,COALESCE((SELECT json_agg(permission) FROM user_permissions WHERE user_id=u.id),'[]') as permissions FROM users u JOIN user_roles r ON r.user_id=u.id ORDER BY u.name",
      )
      .then((r) => r.rows);
  }
  @Require("users.write") @Post() create(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    return this.auth.createUser(body, req.actor.id);
  }
  @Require("users.write") @Patch(":id") async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    uuid(id);
    return this.users.update(id, body, req.actor.id);
  }
}
