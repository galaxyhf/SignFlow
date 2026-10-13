import type { Request, Response } from "express";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "./main";
let application: Promise<INestApplication> | undefined;
export default async function handler(req: Request, res: Response) {
  try {
    application ??= createApp().then(async (app) => {
      await app.init();
      return app;
    });
    const app = await application;
    return app.getHttpAdapter().getInstance()(req, res);
  } catch {
    application = undefined;
    res.status(503).json({ message: "Serviço indisponível" });
  }
}
