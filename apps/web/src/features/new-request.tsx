"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { validateValues, defaultSettings } from "@signflow/shared";
import {
  api,
  post,
  Actor,
  Client,
  Template,
  Version,
  DocumentRecord,
  Listing,
  date,
} from "../lib/api";
import { localDateTime } from "../lib/datetime";
import { Button } from "../components/ui/button";
import { Head, ErrorBox, Loading } from "../components/common";
import { DocumentPreview } from "../components/document-preview";
import { FieldInput } from "../components/field-input";
import { InlineDocumentEditor } from "./templates";

export function NewRequest({ user }: { user: Actor }) {
  return (
    <Suspense fallback={<Loading />}>
      <RequestWizard user={user} />
    </Suspense>
  );
}
function RequestWizard({ user }: { user: Actor }) {
  const router = useRouter(),
    query = useSearchParams(),
    source = query.get("from");
  const [step, setStep] = useState(0),
    [standalone, setStandalone] = useState(false),
    [templateId, setTemplateId] = useState(""),
    [modelSearch, setModelSearch] = useState(""),
    [chosen, setChosen] = useState<Version>(),
    [clientId, setClientId] = useState(""),
    [clientSearch, setClientSearch] = useState(""),
    [title, setTitle] = useState(""),
    [expectedName, setExpectedName] = useState(""),
    [expectedCpf, setExpectedCpf] = useState(""),
    [description, setDescription] = useState(""),
    [ticket, setTicket] = useState(""),
    [notes, setNotes] = useState(""),
    [expires, setExpires] = useState(
      localDateTime(new Date(Date.now() + 7 * 86400000)),
    ),
    [responsibleId, setResponsible] = useState(user.id),
    [internalValues, setInternal] = useState<Record<string, string | boolean>>(
      {},
    ),
    [error, setError] = useState<Error | null>(null);
  const templates = useQuery({
    queryKey: ["templates", "wizard", modelSearch],
    queryFn: () =>
      api<Listing<Template>>(
        `templates?search=${encodeURIComponent(modelSearch)}`,
      ),
  });
  const selected = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => api<Template>(`templates/${templateId}`),
    enabled: !!templateId,
  });
  const clients = useQuery({
    queryKey: ["clients", "wizard", clientSearch],
    queryFn: () =>
      api<Listing<Client>>(
        `clients?active=true&search=${encodeURIComponent(clientSearch)}`,
      ),
  });
  const original = useQuery({
    queryKey: ["document", source],
    queryFn: () => api<DocumentRecord>(`documents/${source}`),
    enabled: !!source,
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<typeof defaultSettings>("settings"),
  });
  useEffect(() => {
    if (settings.data)
      setExpires(
        localDateTime(new Date(Date.now() + settings.data.linkDays * 86400000)),
      );
  }, [settings.data]);
  const people = useQuery({
    queryKey: ["responsibles"],
    queryFn: () => api<{ id: string; name: string }[]>("users/responsibles"),
  });
  useEffect(() => {
    if (original.data) {
      const d = original.data;
      setTitle(d.title);
      setClientId(d.client_id);
      setExpectedName(d.expected_name);
      setExpectedCpf(d.expected_cpf);
      setDescription(d.description);
      setTicket(d.ticket);
      setNotes(d.notes);
      setChosen({
        id: d.template_version_id,
        file_id: d.original_file_id,
        version: 1,
        fields: d.fields,
      });
      setInternal(d.internal_values);
    }
  }, [original.data]);
  const version = chosen || selected.data?.versions[0];
  const create = useMutation({
    mutationFn: () =>
      post<{ id: string; link: string }>("signature-requests", {
        title,
        clientId,
        templateVersionId: version?.id,
        expectedName,
        expectedCpf,
        description,
        ticket,
        notes,
        expiresAt: new Date(expires).toISOString(),
        responsibleId,
        internalValues,
      }),
    onSuccess: (r) => {
      sessionStorage.setItem(`link:${r.id}`, r.link);
      toast.success("Solicitação criada");
      router.push(`/documentos/${r.id}`);
    },
  });
  const stages = [
    "Documento",
    "Cliente",
    "Signatário",
    "Dados internos",
    "Campos",
    "Revisão",
    "Confirmar",
  ];
  function next() {
    try {
      setError(null);
      if (step === 0 && !version)
        throw new Error("Selecione um modelo ou configure um PDF avulso");
      if (step === 1 && !clientId) throw new Error("Selecione um cliente");
      if (step === 2 && expectedName.trim().length < 2)
        throw new Error("Informe o signatário esperado");
      if (step === 3 && (!title || !expires))
        throw new Error("Informe título e validade");
      if (step === 4 && version)
        validateValues(version.fields, internalValues, "employee");
      setStep(Math.min(6, step + 1));
    } catch (e) {
      setError(e as Error);
    }
  }
  if (!user.permissions.includes("requests.write"))
    return <ErrorBox error={new Error("Acesso não autorizado")} />;
  return (
    <>
      <Head
        title="Nova solicitação"
        text="Revise o documento e os dados antes de gerar o link."
      >
        <Button variant="secondary" asChild>
          <Link href="/documentos">
            <ArrowLeft size={15} />
            Voltar
          </Link>
        </Button>
      </Head>
      <div className="stepper">
        {stages.map((s, i) => (
          <span key={s} className={step === i ? "current" : ""}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <ErrorBox
        error={
          error ||
          create.error ||
          selected.error ||
          templates.error ||
          clients.error
        }
      />
      {step === 0 ? (
        <>
          <div className="panel">
            <div className="actions">
              <Button
                variant={!standalone ? "default" : "secondary"}
                onClick={() => setStandalone(false)}
              >
                Usar modelo
              </Button>
              <Button
                variant={standalone ? "default" : "secondary"}
                onClick={() => setStandalone(true)}
              >
                PDF avulso
              </Button>
            </div>
            {!standalone && (
              <label style={{ marginTop: 18 }}>
                Pesquisar modelo
                <input
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Nome do modelo"
                />
              </label>
            )}
            {!standalone && (
              <label style={{ marginTop: 18 }}>
                Modelo publicado
                <select
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    setChosen(undefined);
                    setInternal({});
                  }}
                >
                  <option value="">Selecione</option>
                  {templates.data?.items.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · v{t.version}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {chosen && (
              <p>
                Documento configurado e versão congelada para esta solicitação.
              </p>
            )}
          </div>
          {standalone && (
            <InlineDocumentEditor
              onPublished={(v) => {
                setChosen(v);
                setStandalone(false);
                toast.success("PDF avulso configurado");
              }}
            />
          )}
        </>
      ) : step === 1 ? (
        <div className="panel">
          <label>
            Pesquisar cliente
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Nome, documento ou código"
            />
          </label>
          <label style={{ marginTop: 16 }}>
            Cliente
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const c = clients.data?.items.find(
                  (c) => c.id === e.target.value,
                );
                if (c && !expectedName) setExpectedName(c.name);
              }}
            >
              <option value="">Selecione</option>
              {clients.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.internal_code}
                </option>
              ))}
            </select>
          </label>
          {source &&
            clientId &&
            !clients.data?.items.some((c) => c.id === clientId) && (
              <p>
                Cliente da solicitação original selecionado:{" "}
                {original.data?.client_name}
              </p>
            )}
        </div>
      ) : step === 2 ? (
        <div className="panel form-grid">
          <label>
            Nome do signatário esperado
            <input
              value={expectedName}
              onChange={(e) => setExpectedName(e.target.value)}
            />
          </label>
          <label>
            CPF esperado (opcional)
            <input
              value={expectedCpf}
              onChange={(e) => setExpectedCpf(e.target.value)}
            />
          </label>
          <p className="full">
            O link permite assinatura por quem o possuir. Os dados declarados
            serão comparados com o cadastro após a assinatura.
          </p>
        </div>
      ) : step === 3 ? (
        <div className="panel form-grid">
          <label>
            Título
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Número do chamado
            <input value={ticket} onChange={(e) => setTicket(e.target.value)} />
          </label>
          <label>
            Prazo de validade
            <input
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </label>
          <label>
            Responsável
            <select
              value={responsibleId}
              onChange={(e) => setResponsible(e.target.value)}
            >
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Descrição do serviço
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="full">
            Observações internas
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
      ) : step === 4 ? (
        <div className="panel form-grid">
          {version?.fields
            .filter((f) => f.actor === "employee")
            .map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                value={internalValues[f.id]}
                onChange={(v) => setInternal({ ...internalValues, [f.id]: v })}
              />
            ))}
          {!version?.fields.some((f) => f.actor === "employee") && (
            <p>
              Este documento não possui campos internos. Os campos do signatário
              serão preenchidos no portal.
            </p>
          )}
        </div>
      ) : step === 5 ? (
        <>
          <div className="notice">
            Revise o PDF e as posições dos campos. Os dados internos serão
            incorporados ao confirmar.
          </div>
          {version && (
            <DocumentPreview
              fileId={version.file_id}
              fields={version.fields}
              values={internalValues}
            />
          )}
        </>
      ) : (
        <div className="panel">
          <h2>Pronto para enviar</h2>
          <dl>
            <dt>Documento</dt>
            <dd>{title}</dd>
            <dt>Cliente</dt>
            <dd>
              {clients.data?.items.find((c) => c.id === clientId)?.name ||
                original.data?.client_name}
            </dd>
            <dt>Signatário esperado</dt>
            <dd>{expectedName}</dd>
            <dt>Chamado</dt>
            <dd>{ticket || "—"}</dd>
            <dt>Validade</dt>
            <dd>{date(expires)}</dd>
          </dl>
          <p>
            O documento-base e a declaração de concordância serão congelados.
            Alterações posteriores exigem uma nova solicitação.
          </p>
          <p>Empresa: {settings.data?.companyName || "SignFlow"}</p>
        </div>
      )}
      <div className="actions" style={{ marginTop: 20 }}>
        <Button
          variant="secondary"
          disabled={step === 0 || create.isPending}
          onClick={() => setStep(step - 1)}
        >
          Anterior
        </Button>
        {step < 6 ? (
          <Button onClick={next}>Continuar</Button>
        ) : (
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            Confirmar e gerar link
          </Button>
        )}
      </div>
    </>
  );
}
