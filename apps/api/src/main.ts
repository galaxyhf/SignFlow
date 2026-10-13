import "reflect-metadata";
import "./config/env";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import express from "express";
import { AppModule } from "./app.module";
import { configEnv, secret } from "./config/env";
import { AuthService } from "./modules/auth/auth.service";
import { StorageService } from "./modules/storage/storage.service";
export async function createApp() {
  secret("EVIDENCE_SECRET");
  secret("JOB_SECRET");
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(express.json({ limit: "600kb" }));
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    }),
  );
  app.enableCors({
    origin: configEnv.origin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"],
  });
  app
    .getHttpAdapter()
    .getInstance()
    .set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
  app.use(
    (
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
  );
  await app.get(StorageService).assertPrivate();
  app.use(
    "/openapi",
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      try {
        await app.get(AuthService).authenticate(req.cookies?.sf_session);
        next();
      } catch {
        res.status(401).json({ message: "Autenticação necessária" });
      }
    },
  );
  const docs = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("SignFlow API")
      .setDescription(
        "API interna; contratos Zod em packages/shared. Rotas públicas limitadas por token.",
      )
      .setVersion("1.0")
      .addCookieAuth("sf_session")
      .build(),
  );
  SwaggerModule.setup("openapi", app, docs);
  return app;
}
if (require.main === module)
  createApp()
    .then((app) => app.listen(configEnv.port, "localhost"))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : "Falha ao iniciar");
      process.exit(1);
    });
