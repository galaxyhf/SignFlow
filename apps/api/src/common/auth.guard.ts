import {
  Inject,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { Actor, AuthService } from "../modules/auth/auth.service";
import { Permission } from "@signflow/shared";
import { configEnv } from "../config/env";
export type AuthRequest = Request & { actor: Actor };
export const Public = () => SetMetadata("public", true);
export const Require = (p: Permission) => SetMetadata("permission", p);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(Reflector) private reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    if (
      this.reflector.getAllAndOverride<boolean>("job", [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (mutation && req.headers.origin !== configEnv.origin)
      throw new ForbiddenException("Origem não permitida");
    const isPublic = this.reflector.getAllAndOverride<boolean>("public", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    await this.auth.rate(
      `api:${isPublic ? "public" : "internal"}:${req.ip}`,
      isPublic ? 90 : 300,
      60,
    );
    if (isPublic) return true;
    req.actor = await this.auth.authenticate(
      req.cookies?.sf_session,
      req.header("x-csrf-token"),
      mutation,
    );
    const p =
      this.reflector.getAllAndOverride<Permission>("permission", [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? "read";
    if (
      ["users.write", "settings.write"].includes(p) &&
      req.actor.role !== "admin"
    )
      throw new ForbiddenException("Esta ação exige perfil administrador");
    if (!req.actor.permissions.includes(p))
      throw new ForbiddenException("Você não tem permissão para esta ação");
    return true;
  }
}
