"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import SignaturePad from "signature_pad";
import { toast } from "sonner";
import { FileSignature, CheckCircle, Download, RotateCcw } from "lucide-react";
import { Field, State, validateValues } from "@signflow/shared";
import { api, post, date } from "../lib/api";
import { PdfViewer } from "../components/pdf-viewer";
import { FieldInput } from "../components/field-input";
import { Button } from "../components/ui/button";
import { ErrorBox, Loading } from "../components/common";
import { ConfirmDialog } from "../components/ui/dialog";
type PublicDocument = {
  id: string;
  title: string;
  description: string;
  expiresAt: string;
  status: State;
  fields: Field[];
  companyName: string;
  logoUrl: string;
  consentText: string;
  consentVersion: string;
};
export function SigningPortal({ token }: { token: string }) {
  const data = useQuery({
    queryKey: ["public", token],
    queryFn: () => api<PublicDocument>(`public/sign/${token}`),
    retry: false,
    refetchInterval: (q) =>
      ["processing", "failed"].includes(q.state.data?.status || "")
        ? 4000
        : false,
  });
  return (
    <main className="public-shell">
      <header className="public-head">
        <div className="brand">
          <FileSignature size={24} />
          SignFlow
        </div>
        <Link href="/verificar" className="muted">
          Verificar integridade
        </Link>
      </header>
      <ErrorBox error={data.error} />
      {data.isPending ? (
        <Loading />
      ) : (
        data.data && (
          <SigningForm
            token={token}
            document={data.data}
            refresh={() => data.refetch()}
          />
        )
      )}
    </main>
  );
}
function SigningForm({
  token,
  document: d,
  refresh,
}: {
  token: string;
  document: PublicDocument;
  refresh: () => void;
}) {
  const [name, setName] = useState(""),
    [cpf, setCpf] = useState(""),
    [values, setValues] = useState<Record<string, string | boolean>>({}),
    [signature, setSignature] = useState(""),
    [preparation, setPreparation] = useState<string>(),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [refusing, setRefusing] = useState(false),
    [reason, setReason] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    pad = useRef<SignaturePad | null>(null),
    key = useRef<string>("");
  const completed = ["signed", "reviewed", "divergent"].includes(d.status);
  useEffect(() => {
    if (completed || preparation || !canvas.current) return;
    const c = canvas.current;
    const p = new SignaturePad(c, {
      minWidth: 0.7,
      maxWidth: 2.4,
      penColor: "#111827",
      backgroundColor: "rgba(255,255,255,0)",
    });
    pad.current = p;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2),
        saved = p.toData();
      c.width = c.offsetWidth * ratio;
      c.height = 180 * ratio;
      c.getContext("2d")!.scale(ratio, ratio);
      p.clear();
      p.fromData(saved);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      p.off();
      window.removeEventListener("resize", resize);
    };
  }, [completed, preparation]);
  const prepare = useMutation({
    mutationFn: async () => {
      if (!pad.current || pad.current.isEmpty())
        throw new Error("Desenhe sua assinatura antes de continuar");
      validateValues(d.fields, values, "signer");
      const sig = pad.current.toDataURL();
      setSignature(sig);
      return post<{ preparationId: string }>(`public/sign/${token}/prepare`, {
        name,
        cpf,
        values,
        signature: sig,
      });
    },
    onSuccess: (r) => {
      setPreparation(r.preparationId);
      setAccepted(false);
      key.current = crypto.randomUUID();
    },
  });
  const confirm = useMutation({
    mutationFn: () =>
      post(`public/sign/${token}/confirm`, {
        preparationId: preparation,
        idempotencyKey: key.current,
        accepted,
        consentVersion: d.consentVersion,
      }),
    onSuccess: () => {
      toast.success("Aceite registrado. Gerando documento final.");
      refresh();
    },
  });
  const refuse = useMutation({
    mutationFn: () => post(`public/sign/${token}/refuse`, { reason }),
    onSuccess: () => {
      setRefusing(false);
      refresh();
    },
  });
  if (completed)
    return (
      <>
        <section className="panel">
          <CheckCircle size={36} style={{ color: "var(--success)" }} />
          <h1 style={{ marginTop: 16 }}>Documento assinado</h1>
          <p>
            Sua assinatura e o aceite foram registrados. A empresa fará a
            conferência cadastral interna.
          </p>
          <Button asChild>
            <a href={`/api/public/sign/${token}/signed`} download>
              <Download size={16} />
              Baixar PDF assinado
            </a>
          </Button>
          <p>
            O download por este link fica disponível por 48 horas após a
            conclusão.
          </p>
        </section>
        <PdfViewer url={`/api/public/sign/${token}/signed`} />
      </>
    );
  if (["processing", "failed"].includes(d.status))
    return (
      <section className="panel">
        <h1>
          {d.status === "failed"
            ? "Processamento pendente de recuperação"
            : "Gerando seu documento"}
        </h1>
        <p>
          O aceite já foi registrado.{" "}
          {d.status === "failed"
            ? "A empresa pode retomar o processamento com segurança."
            : "Aguarde a gravação do PDF e das evidências. Esta página atualiza automaticamente."}
        </p>
        <Loading />
      </section>
    );
  return (
    <>
      <section className="panel">
        {d.logoUrl && <img src={d.logoUrl} alt={d.companyName} width={100} />}
        <small className="muted">Solicitado por {d.companyName}</small>
        <h1 style={{ marginTop: 12 }}>{d.title}</h1>
        <p>{d.description}</p>
        <small>Válido até {date(d.expiresAt)}</small>
      </section>
      <ErrorBox
        error={error || prepare.error || confirm.error || refuse.error}
      />
      {preparation ? (
        <>
          <section className="panel">
            <h2>Revise o documento preenchido</h2>
            <p>
              Nome declarado: {name}
              {cpf ? ` · CPF: ${cpf}` : ""}
            </p>
            <img
              className="signature-image"
              src={signature}
              alt="Prévia da assinatura"
            />
          </section>
          <PdfViewer url={`/api/public/sign/${token}/preview/${preparation}`} />
          <section className="panel" style={{ marginTop: 20 }}>
            <label className="check">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              {d.consentText}
            </label>
            <div className="actions" style={{ marginTop: 20 }}>
              <Button
                variant="secondary"
                disabled={confirm.isPending}
                onClick={() => setPreparation(undefined)}
              >
                Corrigir dados
              </Button>
              <Button
                disabled={!accepted || confirm.isPending}
                onClick={() => confirm.mutate()}
              >
                {confirm.isPending ? "Confirmando…" : "Confirmar assinatura"}
              </Button>
            </div>
          </section>
        </>
      ) : (
        <>
          <PdfViewer url={`/api/public/sign/${token}/pdf`} />
          <form
            className="panel"
            style={{ marginTop: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              prepare.mutate();
            }}
          >
            <h2>Preencha seus dados</h2>
            <div className="public-form">
              <label>
                Nome completo declarado
                <input
                  required
                  minLength={2}
                  maxLength={255}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                CPF declarado (opcional)
                <input
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                />
              </label>
              {d.fields
                .filter((f) => f.type !== "signature")
                .map((f) => (
                  <FieldInput
                    key={f.id}
                    field={f}
                    value={values[f.id]}
                    onChange={(v) => setValues({ ...values, [f.id]: v })}
                  />
                ))}
            </div>
            <h2 style={{ marginTop: 24 }}>Sua assinatura</h2>
            <p>
              Desenhe com o mouse ou com o dedo. A assinatura será posicionada
              no documento.
            </p>
            <canvas
              className="signature-canvas"
              ref={canvas}
              aria-label="Área para desenhar sua assinatura"
            />
            <div className="actions" style={{ marginTop: 12 }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => pad.current?.clear()}
              >
                <RotateCcw size={14} />
                Limpar e refazer
              </Button>
              <Button disabled={prepare.isPending}>
                {prepare.isPending
                  ? "Preparando revisão…"
                  : "Revisar documento"}
              </Button>
            </div>
          </form>
          <details className="panel">
            <summary>Deseja recusar a solicitação?</summary>
            <label>
              Motivo
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                minLength={5}
              />
            </label>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 5}
              onClick={() => setRefusing(true)}
            >
              Recusar assinatura
            </Button>
          </details>
        </>
      )}
      <p>
        O acesso por link e a assinatura desenhada registram sua declaração. Não
        há autenticação de identidade civil.
      </p>
      <ConfirmDialog
        open={refusing}
        onOpenChange={setRefusing}
        title="Recusar esta solicitação?"
        description="O link deixará de aceitar assinaturas e o motivo será registrado."
        onConfirm={() => refuse.mutate()}
      />
    </>
  );
}
