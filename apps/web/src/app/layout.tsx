import type { Metadata } from "next";
import { Providers } from "../providers/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: "SignFlow — Documentos e assinaturas",
  description: "Autorizações, assinaturas eletrônicas e conferência cadastral.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
