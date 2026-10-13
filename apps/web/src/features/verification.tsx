"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileSignature, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { ErrorBox } from "../components/common";
export function VerificationPage() {
  const [id, setId] = useState(""),
    [file, setFile] = useState<File>();
  const check = useMutation({
    mutationFn: () => {
      const body = new FormData();
      body.append("id", id);
      if (file) body.append("file", file);
      return api<{
        registered: boolean;
        matches: boolean | null;
        hash: string | null;
        notice: string;
      }>("verification/check", { method: "POST", body });
    },
  });
  return (
    <main className="public-shell">
      <header className="public-head">
        <Link href="/" className="brand">
          <FileSignature />
          SignFlow
        </Link>
      </header>
      <section className="panel">
        <ShieldCheck size={30} />
        <h1 style={{ marginTop: 14 }}>Verificar integridade</h1>
        <p>
          Consulte o identificador da solicitação. Envie o PDF para comparar seu
          hash com o documento final registrado.
        </p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            check.mutate();
          }}
        >
          <label>
            Identificador da solicitação
            <input
              required
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="UUID da solicitação"
            />
          </label>
          <label>
            PDF para comparar (opcional)
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
          <Button disabled={check.isPending}>
            {check.isPending ? "Verificando…" : "Verificar"}
          </Button>
        </form>
        <ErrorBox error={check.error} />
        {check.data && (
          <div className="notice" style={{ marginTop: 20 }}>
            <strong>
              {check.data.registered
                ? "Documento final registrado"
                : "Não há documento final registrado para este identificador"}
            </strong>
            {check.data.matches !== null && (
              <p>
                {check.data.matches
                  ? "O hash corresponde ao arquivo registrado."
                  : "O hash não corresponde ao arquivo registrado."}
              </p>
            )}
            {check.data.hash && (
              <div className="hash">SHA-256: {check.data.hash}</div>
            )}
            <p>{check.data.notice}</p>
          </div>
        )}
        <p>
          A consulta pública não divulga dados pessoais ou o conteúdo do
          documento. Evidências detalhadas exigem acesso interno.
        </p>
      </section>
    </main>
  );
}
