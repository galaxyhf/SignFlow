"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Upload,
  Save,
  Trash2,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Field, fieldTypes, fieldLabels, fieldsSchema } from "@signflow/shared";
import { api, post, Actor, Template, Listing, Version } from "../lib/api";
import { Button } from "../components/ui/button";
import {
  Head,
  ErrorBox,
  Loading,
  Empty,
  Pagination,
} from "../components/common";
import { DocumentPreview } from "../components/document-preview";
import { PdfViewer } from "../components/pdf-viewer";
export function Templates({ user }: { user: Actor }) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const data = useQuery({
    queryKey: ["templates", search, page],
    queryFn: () =>
      api<Listing<Template>>(
        `templates?search=${encodeURIComponent(search)}&page=${page}`,
      ),
  });
  return (
    <>
      <Head
        title="Modelos de documentos"
        text="Publique versões reutilizáveis com campos posicionados no PDF."
      >
        {user.permissions.includes("templates.write") && (
          <Button asChild>
            <Link href="/modelos/novo">
              <Plus size={16} />
              Criar modelo
            </Link>
          </Button>
        )}
      </Head>
      <div className="filters">
        <label>
          Pesquisar
          <input
            placeholder="Nome do modelo"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <ErrorBox error={data.error} />
      {data.isPending ? (
        <Loading />
      ) : data.data?.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Versão publicada</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/modelos/${t.id}`}>{t.name}</Link>
                    <small>{t.description}</small>
                  </td>
                  <td>v{t.version}</td>
                  <td>
                    <Button variant="secondary" asChild>
                      <Link
                        href={`/modelos/${t.id}${user.permissions.includes("templates.write") ? "/editar" : ""}`}
                      >
                        {user.permissions.includes("templates.write")
                          ? "Nova versão"
                          : "Visualizar"}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Crie seu primeiro modelo"
          text="Envie um PDF e posicione os campos que o cliente deverá preencher."
        />
      )}
      <Pagination
        page={page}
        total={data.data?.total || 0}
        onChange={setPage}
      />
    </>
  );
}
export function TemplateEditor({
  id,
  readOnly = false,
  user,
}: {
  id?: string;
  readOnly?: boolean;
  user: Actor;
}) {
  const template = useQuery({
    queryKey: ["template", id],
    queryFn: () => api<Template>(`templates/${id}`),
    enabled: !!id,
  });
  if (id && template.isPending) return <Loading />;
  if (template.error) return <ErrorBox error={template.error} />;
  return (
    <Editor
      key={id || "new"}
      id={id}
      template={template.data}
      readOnly={readOnly || !user.permissions.includes("templates.write")}
      canEdit={user.permissions.includes("templates.write")}
    />
  );
}
export function InlineDocumentEditor({
  onPublished,
}: {
  onPublished: (v: Version) => void;
}) {
  return <Editor readOnly={false} onPublished={onPublished} />;
}
function Editor({
  id,
  template,
  readOnly,
  onPublished,
  canEdit = true,
}: {
  id?: string;
  template?: Template;
  readOnly: boolean;
  onPublished?: (v: Version) => void;
  canEdit?: boolean;
}) {
  const router = useRouter(),
    client = useQueryClient();
  const [version, setVersion] = useState(template?.versions[0]);
  const [name, setName] = useState(template?.name || ""),
    [description, setDescription] = useState(template?.description || ""),
    [fileId, setFileId] = useState(version?.file_id || ""),
    [fields, setFields] = useState<Field[]>(version?.fields || []),
    [selected, setSelected] = useState<string>(),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(1),
    [zoom, setZoom] = useState(1),
    [preview, setPreview] = useState(false);
  const f = fields.find((x) => x.id === selected);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return api<{ id: string; pages: number }>("files/upload", {
        method: "POST",
        body,
      });
    },
    onSuccess: (r) => {
      setFileId(r.id);
      setPages(r.pages);
      setFields([]);
      setPage(0);
      toast.success("PDF validado e armazenado");
    },
  });
  const save = useMutation({
    mutationFn: () =>
      post<{ id: string; version: Version }>(
        id ? `templates/${id}/versions` : "templates",
        {
          name,
          description,
          fileId,
          standalone: !!onPublished,
          fields: fieldsSchema.parse(fields),
        },
      ),
    onSuccess: (r) => {
      client.invalidateQueries({ queryKey: ["templates"] });
      client.invalidateQueries({ queryKey: ["template", id] });
      toast.success("Versão publicada");
      if (onPublished) onPublished(r.version);
      else router.push(`/modelos/${r.id}`);
    },
  });
  function update(patch: Partial<Field>) {
    setFields(fields.map((x) => (x.id === selected ? { ...x, ...patch } : x)));
  }
  function add(type: Field["type"]) {
    const field: Field = {
      id: crypto.randomUUID(),
      name: `campo_${fields.length + 1}_${Math.floor(Math.random() * 1000)}`,
      label: fieldLabels[type],
      type,
      page,
      x: 0.1,
      y: Math.min(
        0.8,
        0.15 + fields.filter((f) => f.page === page).length * 0.06,
      ),
      width: type === "signature" ? 0.4 : 0.3,
      height: type === "signature" ? 0.12 : type === "textarea" ? 0.1 : 0.04,
      required: true,
      actor: "signer",
      defaultValue: "",
      options: type === "select" ? ["Opção 1"] : [],
      validation: {},
    };
    setFields([...fields, field]);
    setSelected(field.id);
  }
  return (
    <>
      <Head
        title={readOnly ? name : id ? "Publicar nova versão" : "Criar modelo"}
        text="As versões publicadas preservam os documentos já enviados."
      >
        <Button variant="secondary" asChild>
          <Link href="/modelos">
            <ArrowLeft size={15} />
            Voltar
          </Link>
        </Button>
        {!readOnly && (
          <Button
            onClick={() => save.mutate()}
            disabled={!fileId || save.isPending}
          >
            <Save size={15} />
            Publicar versão
          </Button>
        )}
        {readOnly && id && canEdit && (
          <Button asChild>
            <Link href={`/modelos/${id}/editar`}>Editar nova versão</Link>
          </Button>
        )}
      </Head>
      <ErrorBox error={upload.error || save.error} />
      <section className="panel form-grid">
        <label>
          Nome do modelo
          <input
            value={name}
            disabled={readOnly}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Descrição
          <input
            value={description}
            disabled={readOnly}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {template && readOnly && (
          <label>
            Versão
            <select
              value={version?.id}
              onChange={(e) => {
                const v = template.versions.find(
                  (v) => v.id === e.target.value,
                )!;
                setVersion(v);
                setFileId(v.file_id);
                setFields(v.fields);
                setPage(0);
              }}
            >
              {template.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                </option>
              ))}
            </select>
          </label>
        )}
        {!readOnly && (
          <label>
            PDF original
            <Upload size={18} />
            <input
              type="file"
              accept="application/pdf"
              disabled={upload.isPending}
              onChange={(e) => {
                if (e.target.files?.[0]) upload.mutate(e.target.files[0]);
              }}
            />
            <small className="muted">
              Até 3 MB. Um novo PDF reinicia os campos do editor.
            </small>
          </label>
        )}
      </section>
      {fileId ? (
        <div className="editor-layout">
          <aside className="editor-side">
            <h3>Adicionar campo</h3>
            {!readOnly && (
              <div className="field-buttons">
                {fieldTypes.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant="secondary"
                    onClick={() => add(t)}
                  >
                    {fieldLabels[t]}
                  </Button>
                ))}
              </div>
            )}
            <h3>Campos ({fields.length})</h3>
            {fields.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={selected === f.id ? "default" : "ghost"}
                onClick={() => {
                  setSelected(f.id);
                  setPage(f.page);
                }}
              >
                {f.label} · p{f.page + 1}
              </Button>
            ))}
          </aside>
          <div>
            <div className="editor-tools">
              <label>
                Página
                <select
                  className="toolbar-select"
                  value={page}
                  onChange={(e) => setPage(Number(e.target.value))}
                >
                  {Array.from({ length: pages }, (_, i) => (
                    <option key={i} value={i}>
                      {i + 1} de {pages}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="secondary"
                aria-label="Reduzir zoom"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              >
                <ZoomOut size={15} />
              </Button>
              <span>{Math.round(zoom * 100)}%</span>
              <Button
                variant="secondary"
                aria-label="Aumentar zoom"
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              >
                <ZoomIn size={15} />
              </Button>
              {!readOnly && (
                <Button
                  variant="secondary"
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? "Editar campos" : "Pré-visualizar"}
                </Button>
              )}
            </div>
            <>
              {preview ? (
                <DocumentPreview fileId={fileId} fields={fields} />
              ) : (
                <PdfViewer
                  url={`/api/files/${fileId}`}
                  fields={fields}
                  editable={!readOnly && !preview}
                  selected={selected}
                  onSelect={setSelected}
                  onChange={setFields}
                  zoom={zoom}
                  page={page}
                  onPages={setPages}
                />
              )}
            </>
          </div>
          <aside className="editor-side properties">
            <h3>Propriedades do campo</h3>
            {f ? (
              <>
                <label>
                  Nome interno
                  <input
                    value={f.name}
                    disabled={readOnly}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <label>
                  Rótulo
                  <input
                    value={f.label}
                    disabled={readOnly}
                    onChange={(e) => update({ label: e.target.value })}
                  />
                </label>
                <label>
                  Preenchido por
                  <select
                    value={f.actor}
                    disabled={readOnly || f.type === "signature"}
                    onChange={(e) =>
                      update({ actor: e.target.value as Field["actor"] })
                    }
                  >
                    <option value="signer">Signatário</option>
                    <option value="employee">Funcionário</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={f.required}
                    disabled={readOnly}
                    onChange={(e) => update({ required: e.target.checked })}
                  />
                  Obrigatório
                </label>
                {f.type !== "signature" && f.type !== "checkbox" && (
                  <label>
                    Valor padrão
                    <input
                      value={f.defaultValue}
                      disabled={readOnly}
                      onChange={(e) => update({ defaultValue: e.target.value })}
                    />
                  </label>
                )}
                {f.type === "select" && (
                  <label>
                    Opções (uma por linha)
                    <textarea
                      value={f.options.join("\n")}
                      disabled={readOnly}
                      onChange={(e) =>
                        update({ options: e.target.value.split("\n") })
                      }
                    />
                  </label>
                )}
                {["text", "name", "textarea", "phone"].includes(f.type) && (
                  <label>
                    Máximo de caracteres
                    <input
                      type="number"
                      min={1}
                      max={4000}
                      value={f.validation.maxLength || ""}
                      disabled={readOnly}
                      onChange={(e) =>
                        update({
                          validation: {
                            ...f.validation,
                            maxLength: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          },
                        })
                      }
                    />
                  </label>
                )}
                {f.type === "number" && (
                  <>
                    <label>
                      Mínimo
                      <input
                        type="number"
                        value={f.validation.min ?? ""}
                        disabled={readOnly}
                        onChange={(e) =>
                          update({
                            validation: {
                              ...f.validation,
                              min: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Máximo
                      <input
                        type="number"
                        value={f.validation.max ?? ""}
                        disabled={readOnly}
                        onChange={(e) =>
                          update({
                            validation: {
                              ...f.validation,
                              max: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            },
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {(["x", "y", "width", "height"] as const).map((k) => (
                  <label key={k}>
                    {
                      {
                        x: "Posição X",
                        y: "Posição Y",
                        width: "Largura",
                        height: "Altura",
                      }[k]
                    }{" "}
                    (%)
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={Math.round(f[k] * 1000) / 10}
                      disabled={readOnly}
                      onChange={(e) =>
                        update({ [k]: Number(e.target.value) / 100 })
                      }
                    />
                  </label>
                ))}
                {!readOnly && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setFields(fields.filter((x) => x.id !== selected));
                      setSelected(undefined);
                    }}
                  >
                    <Trash2 size={14} />
                    Excluir campo
                  </Button>
                )}
              </>
            ) : (
              <p>
                Selecione um campo no documento. Use as setas do teclado para
                ajustar a posição.
              </p>
            )}
          </aside>
        </div>
      ) : (
        <Empty
          title="Envie o PDF original"
          text="O documento será validado antes de entrar no editor."
        />
      )}
    </>
  );
}
