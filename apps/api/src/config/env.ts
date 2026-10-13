import { config } from "dotenv";
import { resolve } from "node:path";
config({
  path: resolve(
    process.cwd(),
    process.cwd().endsWith("/apps/api") ? "../../.env" : ".env",
  ),
  quiet: true,
});
export function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável obrigatória ausente: ${name}`);
  return v;
}
export function secret(name: string) {
  const v = required(name);
  if (v.length < 32)
    throw new Error(`${name} precisa de pelo menos 32 caracteres`);
  return v;
}
export const configEnv = {
  port: Number(process.env.PORT || 3001),
  origin: process.env.WEB_ORIGIN || "http://127.0.0.1:3000",
  production: process.env.NODE_ENV === "production",
  maxBytes: Math.min(Number(process.env.MAX_UPLOAD_MB || 3), 3) * 1024 * 1024,
  maxPages: Number(process.env.MAX_PDF_PAGES || 30),
};
