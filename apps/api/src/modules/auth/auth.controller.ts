import { ApiInput } from "../../common/openapi";
import { loginSchema, registerSchema, passwordSchema } from "@signflow/shared";
import { Inject, Controller, Get, Post, Body, Req, Res } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Response } from "express";
import { z } from "zod";
import { Public, AuthRequest } from "../../common/auth.guard";
import { AuthService } from "./auth.service";
import { configEnv } from "../../config/env";
@ApiTags("Autenticação")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  @Public()
  @Post("login")
  @ApiInput(loginSchema)
  @ApiOperation({
    summary: "Entrar com usuário e senha; emite cookies de sessão e CSRF",
  })
  async login(
    @Body() body: unknown,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.login(body, req.ip || "unknown");
    res.cookie("sf_session", r.sessionToken, {
      httpOnly: true,
      secure: configEnv.production,
      sameSite: "strict",
      expires: r.expires,
      path: "/",
    });
    res.cookie("sf_csrf", r.csrf, {
      httpOnly: false,
      secure: configEnv.production,
      sameSite: "strict",
      expires: r.expires,
      path: "/",
    });
    return { user: r.user };
  }
  @Public()
  @Post("register")
  @ApiInput(registerSchema)
  @ApiOperation({
    summary: "Cadastrar conta de funcionário com nome, login e senha",
  })
  register(@Body() body: unknown, @Req() req: AuthRequest) {
    return this.auth.register(body, req.ip || "unknown");
  }
  @Get("me") me(@Req() req: AuthRequest) {
    return req.actor;
  }
  @Post("logout") async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies.sf_session, req.actor);
    res.clearCookie("sf_session", { path: "/" });
    res.clearCookie("sf_csrf", { path: "/" });
    return { success: true };
  }
  @Post("password") async password(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const v = z
      .object({
        current: z.string().max(128),
        next: passwordSchema,
      })
      .parse(body);
    await this.auth.changePassword(req.actor, v.current, v.next);
    return { success: true };
  }
}
