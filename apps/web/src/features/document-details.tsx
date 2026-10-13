"use client";
import { eventLabel } from "../lib/events";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Copy,
  MessageCircle,
  Download,
  ArrowLeft,
  Check,
  X,
  RotateCw,
} from "lucide-react";
import { whatsappMessage, defaultSettings } from "@signflow/shared";
import { api, post, Actor, DocumentRecord, date } from "../lib/api";
import { localDateTime } from "../lib/datetime";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/dialog";
import { Head, ErrorBox, Loading, Empty, Status } from "../components/common";
import { PdfViewer } from "../components/pdf-viewer";

export function DocumentDetails({ id, user }: { id: string; user: Actor }) {
  const client = useQueryClient();
  const [tab, setTab] = useState("Detalhes"),
    [link, setLink] = useState(""),
    [action, setAction] = useState<string>(),
    [notes, setNotes] = useState(""),
    [expiry, setExpiry] = useState(
      localDateTime(new Date(Date.now() + 7 * 86400000)),
    );
  const data = useQuery({
    queryKey: ["document", id],
    queryFn: () => api<DocumentRecord>(`documents/${id}`),
    refetchInterval: (q) =>
      ["processing", "failed"].includes(q.state.data?.status || "")
        ? 5000
        : false,
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<typeof defaultSettings>("settings"),
  });
  useEffect(() => {
    setLink(sessionStorage.getItem(`link:${id}`) || "");
  }, [id]);
  const mutate = useMutation({
    mutationFn: (a: string) =>
      post<{ link?: string }>(
        `signature-requests/${id}/${a}`,
        a === "renew" ? { expiresAt: new Date(expiry).toISOString() } : {},
      ),
    onSuccess: (r) => {
      if (r.link) {
        setLink(r.link);
        sessionStorage.setItem(`link:${id}`, r.link);
      } else if (action === "cancel" || action === "revoke") {
        setLink("");
        sessionStorage.removeItem(`link:${id}`);
      }
      client.invalidateQueries({ queryKey: ["document", id] });
      toast.success("Solicitação atualizada");
      setAction(undefined);
    },
  });
  const review = useMutation({
    mutationFn: (result: string) =>
      post(`documents/${id}/reviews`, { result, notes }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["document", id] });
      setNotes("");
      toast.success("Conferência registrada");
    },
  });
  if (data.isPending) return <Loading />;
  if (data.error)
    return <ErrorBox error={data.error} retry={() => data.refetch()} />;
  const d = data.data!;
  const message = whatsappMessage(
    settings.data?.whatsappMessage || defaultSettings.whatsappMessage,
    settings.data?.companyName || "SignFlow",
    d.title,
    link,
  );
  const writable = user.permissions.includes("requests.write"),
    signable = ["pending", "viewed", "filling", "expired"].includes(d.status);
  async function copy(v: string) {
    try {
      await navigator.clipboard.writeText(v);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie o texto.");
    }
  }
  return (
    <>
      <Head
        title={d.title}
        text={`Chamado ${d.ticket || "não informado"} · ${d.client_name}`}
      >
        <Status value={d.status} />
        <Button variant="secondary" asChild>
          <Link href="/documentos">
            <ArrowLeft size={14} />
            Voltar
          </Link>
        </Button>
      </Head>
      <ErrorBox error={mutate.error || review.error} />
      <div className="tabs">
        {[
          "Detalhes",
          "Documento",
          "Histórico",
          "Evidências",
          "Conferência",
        ].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Detalhes" ? (
        <>
          <section className="panel">
            <dl>
              <dt>Identificador</dt>
              <dd className="hash">{d.id}</dd>
              <dt>Cliente</dt>
              <dd>
                {d.client_name} · {d.internal_code}
              </dd>
              <dt>Signatário esperado</dt>
              <dd>{d.expected_name}</dd>
              <dt>Descrição</dt>
              <dd>{d.description || "—"}</dd>
              <dt>Observações internas</dt>
              <dd>{d.notes || "—"}</dd>
              <dt>Criado em</dt>
              <dd>{date(d.created_at)}</dd>
              <dt>Validade</dt>
              <dd>{date(d.expires_at)}</dd>
            </dl>
          </section>
          {writable && (
            <section className="panel">
              <h2>Compartilhar solicitação</h2>
              {link && signable ? (
                <>
                  <p className="link-box">{link}</p>
                  <div className="actions">
                    <Button variant="secondary" onClick={() => copy(link)}>
                      <Copy size={15} />
                      Copiar link
                    </Button>
                    <Button variant="secondary" onClick={() => copy(message)}>
                      Copiar mensagem
                    </Button>
                    <Button asChild>
                      <a
                        href={`https://wa.me/${d.whatsapp}?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle size={15} />
                        Enviar pelo WhatsApp
                      </a>
                    </Button>
                  </div>
                  <p>
                    Confirme o envio no WhatsApp. O clique não comprova entrega.
                  </p>
                </>
              ) : signable ? (
                <p>
                  O token só é exibido quando gerado. Para obter outro link,
                  gere um novo abaixo; o anterior será invalidado.
                </p>
              ) : (
                <p>Esta solicitação não aceita mais preenchimento.</p>
              )}
              {signable && (
                <div className="filters">
                  <label>
                    Nova validade
                    <input
                      type="datetime-local"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                    />
                  </label>
                  <Button
                    variant="secondary"
                    onClick={() => setAction("renew")}
                  >
                    Gerar novo link
                  </Button>
                </div>
              )}
              <div className="actions">
                {["pending", "viewed", "filling"].includes(d.status) && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setAction("cancel")}
                    >
                      Cancelar solicitação
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setAction("revoke")}
                    >
                      Revogar link
                    </Button>
                  </>
                )}
                {d.status === "failed" && (
                  <Button
                    onClick={() => mutate.mutate("retry")}
                    disabled={mutate.isPending}
                  >
                    <RotateCw size={14} />
                    Recuperar processamento
                  </Button>
                )}
                <Button asChild variant="secondary">
                  <Link href={`/documentos/novo?from=${id}`}>
                    Criar a partir desta
                  </Link>
                </Button>
              </div>
            </section>
          )}
        </>
      ) : tab === "Documento" ? (
        <>
          <div className="actions" style={{ marginBottom: 20 }}>
            <Button asChild variant="secondary">
              <a href={`/api/documents/${id}/original`} download>
                <Download size={15} />
                Baixar original
              </a>
            </Button>
            {d.signature?.final_file_id && (
              <Button asChild>
                <a href={`/api/files/${d.signature.final_file_id}`} download>
                  <Download size={15} />
                  Baixar assinado
                </a>
              </Button>
            )}
          </div>
          <PdfViewer
            url={`/api/files/${d.signature?.final_file_id || d.presented_file_id}`}
          />
        </>
      ) : tab === "Histórico" ? (
        <section className="panel">
          <h2>Histórico preservado</h2>
          {d.history.map((e) => (
            <div className="list-row" key={e.id}>
              <strong>{eventLabel(e.action)}</strong>
              <small>
                {date(e.created_at)} · {e.actor_name || "Sistema / signatário"}
              </small>
              <details>
                <summary>Dados do evento</summary>
                <pre className="hash">{JSON.stringify(e.data, null, 2)}</pre>
                <div className="hash">Hash: {e.hash}</div>
              </details>
            </div>
          ))}
        </section>
      ) : tab === "Evidências" ? (
        d.signature ? (
          <section className="panel">
            <h2>Identificação declarada e evidências técnicas</h2>
            <dl>
              <dt>Nome declarado</dt>
              <dd>{d.signature.name}</dd>
              <dt>CPF declarado</dt>
              <dd>{d.signature.cpf || "Não informado"}</dd>
              <dt>Aceite</dt>
              <dd>{date(d.signature.accepted_at)}</dd>
              <dt>Geração final</dt>
              <dd>
                {d.signature.signed_at
                  ? date(d.signature.signed_at)
                  : "Em processamento"}
              </dd>
              <dt>IP observado</dt>
              <dd>{d.signature.ip}</dd>
              <dt>Navegador</dt>
              <dd>{d.signature.user_agent}</dd>
              <dt>Declaração aceita</dt>
              <dd>{d.signature.consent_text}</dd>
              <dt>Versão</dt>
              <dd className="hash">{d.signature.consent_version}</dd>
            </dl>
            {d.evidence && (
              <>
                <details>
                  <summary>Manifesto e hashes</summary>
                  <pre className="hash">
                    {JSON.stringify(d.evidence.manifest, null, 2)}
                  </pre>
                  <div className="hash">HMAC: {d.evidence.hmac}</div>
                </details>
                <Button asChild variant="secondary">
                  <a href={`/api/files/${d.evidence.file_id}`} download>
                    Baixar pacote de evidências
                  </a>
                </Button>
              </>
            )}
            <p>
              A identificação é declarada. A integridade do arquivo e a
              conferência cadastral não comprovam identidade civil.
            </p>
          </section>
        ) : (
          <Empty
            title="Ainda não há evidências de assinatura"
            text="O pacote será preservado após a confirmação e geração do PDF."
          />
        )
      ) : d.signature ? (
        <>
          <div className="comparison">
            <section className="panel">
              <h2>Dados do cadastro</h2>
              <dl>
                <dt>Cliente</dt>
                <dd>{d.client_name}</dd>
                <dt>CPF/CNPJ</dt>
                <dd>{d.tax_id}</dd>
                <dt>Código interno</dt>
                <dd>{d.internal_code}</dd>
                <dt>Responsável esperado</dt>
                <dd>{d.expected_name}</dd>
                <dt>CPF esperado</dt>
                <dd>{d.expected_cpf || "Não informado"}</dd>
                <dt>Chamado</dt>
                <dd>{d.ticket || "—"}</dd>
              </dl>
            </section>
            <section className="panel">
              <h2>Dados informados</h2>
              <dl>
                <dt>Nome declarado</dt>
                <dd>{d.signature.name}</dd>
                <dt>CPF declarado</dt>
                <dd>{d.signature.cpf || "Não informado"}</dd>
                <dt>Aceite</dt>
                <dd>{date(d.signature.accepted_at)}</dd>
              </dl>
              {d.signature.signature_file_id && (
                <img
                  className="signature-image"
                  src={`/api/files/${d.signature.signature_file_id}`}
                  alt="Assinatura desenhada do signatário"
                />
              )}
            </section>
          </div>
          {user.permissions.includes("reviews.write") &&
            ["signed", "reviewed", "divergent"].includes(d.status) && (
              <section className="panel">
                <h2>Registrar conferência cadastral</h2>
                <p>
                  Compare os dados com o cadastro interno. Este procedimento não
                  comprova identidade civil.
                </p>
                <label>
                  Observações / justificativa
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <div className="actions" style={{ marginTop: 16 }}>
                  <Button
                    disabled={review.isPending}
                    onClick={() => review.mutate("reviewed")}
                  >
                    <Check size={16} />
                    Dados conferem
                  </Button>
                  <Button
                    disabled={review.isPending || notes.trim().length < 5}
                    variant="destructive"
                    onClick={() => review.mutate("divergent")}
                  >
                    <X size={16} />
                    Dados divergentes
                  </Button>
                </div>
              </section>
            )}
          <section className="panel">
            <h2>Histórico de conferências</h2>
            {d.reviews.length ? (
              d.reviews.map((r) => (
                <div className="list-row" key={r.id}>
                  <Status value={r.result} />
                  <p>{r.notes || "Sem observações"}</p>
                  <small>
                    {r.reviewer_name} · {date(r.created_at)}
                  </small>
                </div>
              ))
            ) : (
              <Empty text="A assinatura aguarda comparação com o cadastro interno." />
            )}
          </section>
        </>
      ) : (
        <Empty
          title="Documento ainda não assinado"
          text="A conferência ficará disponível após o processamento da assinatura."
        />
      )}
      <ConfirmDialog
        open={!!action}
        onOpenChange={(v) => !v && setAction(undefined)}
        title={
          action === "renew"
            ? "Substituir link de assinatura?"
            : "Invalidar esta solicitação?"
        }
        description={
          action === "renew"
            ? "O link anterior deixará de funcionar. O documento-base será preservado."
            : "O cliente não poderá mais preencher ou assinar pelo link atual. O histórico será preservado."
        }
        onConfirm={() => action && mutate.mutate(action)}
      />
    </>
  );
}
