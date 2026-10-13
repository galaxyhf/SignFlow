"use client";
import { eventLabel } from "../lib/events";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { toast } from "sonner";
import { Plus, ShieldCheck } from "lucide-react";
import {
  roles,
  permissions,
  userSchema,
  settingsSchema,
  defaultSettings,
  Role,
} from "@signflow/shared";
import { api, post, Actor, Event, Listing, date } from "../lib/api";
import { Button } from "../components/ui/button";
import {
  Head,
  ErrorBox,
  Loading,
  Pagination,
  Empty,
} from "../components/common";
type User = Actor & { active: boolean };
const permissionLabels: Record<string, string> = {
  read: "Consultar documentos",
  "clients.write": "Gerenciar clientes",
  "templates.write": "Gerenciar modelos",
  "requests.write": "Criar solicitações",
  "reviews.write": "Conferir cadastro",
  "users.write": "Gerenciar funcionários",
  "settings.write": "Administrar configurações",
  "audit.read": "Consultar auditoria",
};
const roleLabels = {
  admin: "Administrador",
  employee: "Funcionário",
  auditor: "Auditor",
};
export function UsersPage() {
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const client = useQueryClient(),
    data = useQuery({
      queryKey: ["users"],
      queryFn: () => api<User[]>("users"),
    });
  return (
    <>
      <Head title="Funcionários" text="Perfis, permissões e acesso ao sistema.">
        <Button onClick={() => setEditing(null)}>
          <Plus size={15} />
          Cadastrar funcionário
        </Button>
      </Head>
      <ErrorBox error={data.error} />
      {editing !== undefined ? (
        <UserForm
          key={editing?.id || "new"}
          user={editing}
          done={() => {
            setEditing(undefined);
            client.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      ) : data.isPending ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.data?.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.login}</td>
                  <td>{roleLabels[u.role as Role]}</td>
                  <td>{u.active ? "Ativo" : "Inativo"}</td>
                  <td>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(u)}
                    >
                      Gerenciar acesso
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
function UserForm({ user, done }: { user: User | null; done: () => void }) {
  const [name, setName] = useState(user?.name || ""),
    [login, setLogin] = useState(user?.login || ""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState<Role>((user?.role as Role) || "employee"),
    [active, setActive] = useState(user?.active ?? true),
    [custom, setCustom] = useState<string[]>(user?.permissions || []);
  const mutation = useMutation({
    mutationFn: () =>
      api(user ? `users/${user.id}` : "users", {
        method: user ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          login,
          password,
          role,
          active,
          permissions: custom,
        }),
      }),
    onSuccess: () => {
      toast.success("Acesso salvo; sessões anteriores foram revogadas");
      done();
    },
  });
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        if (!user) {
          try {
            userSchema.parse({
              name,
              login,
              password,
              role,
              active,
              permissions: custom,
            });
          } catch (e) {
            toast.error((e as Error).message);
            return;
          }
        }
        mutation.mutate();
      }}
    >
      <label>
        Nome
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label>
        Login
        <input
          value={login}
          disabled={!!user}
          onChange={(e) => setLogin(e.target.value)}
          required
        />
      </label>
      {!user && (
        <label>
          Senha inicial
          <input
            type="password"
            minLength={9}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      )}
      <label>
        Perfil
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => (
            <option value={r} key={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Usuário ativo
      </label>
      <fieldset className="full">
        <legend>Permissões adicionais ao perfil</legend>
        <div className="form-grid">
          {permissions.map((p) => (
            <label className="check" key={p}>
              <input
                type="checkbox"
                checked={custom.includes(p)}
                onChange={(e) =>
                  setCustom(
                    e.target.checked
                      ? [...custom, p]
                      : custom.filter((x) => x !== p),
                  )
                }
              />
              {permissionLabels[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="full">
        <ErrorBox error={mutation.error} />
        <div className="actions">
          <Button disabled={mutation.isPending}>Salvar acesso</Button>
          <Button type="button" variant="secondary" onClick={done}>
            Voltar
          </Button>
        </div>
      </div>
    </form>
  );
}
export function SettingsPage({ user }: { user: Actor }) {
  const data = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<typeof defaultSettings>("settings"),
  });
  return (
    <>
      <Head
        title="Configurações"
        text="Empresa, documentos e controles de acesso."
      />
      {!(
        user.role === "admin" && user.permissions.includes("settings.write")
      ) && (
        <div className="notice" role="status">
          Você está no perfil {roleLabels[user.role as Role] || user.role}.
          Apenas administradores podem editar as configurações da empresa. Sua
          senha pode ser alterada abaixo.
        </div>
      )}
      <ErrorBox error={data.error} />
      {data.isPending ? (
        <Loading />
      ) : (
        data.data && (
          <SettingsForm
            settings={data.data}
            editable={
              user.role === "admin" &&
              user.permissions.includes("settings.write")
            }
          />
        )
      )}
      <PasswordForm />
    </>
  );
}
function SettingsForm({
  settings,
  editable,
}: {
  settings: typeof defaultSettings;
  editable: boolean;
}) {
  const client = useQueryClient();
  const { setTheme } = useTheme();
  const form = useForm<
    z.input<typeof settingsSchema>,
    unknown,
    z.output<typeof settingsSchema>
  >({ resolver: zodResolver(settingsSchema), defaultValues: settings });
  const save = useMutation({
    mutationFn: (b: typeof defaultSettings) =>
      api("settings", { method: "PUT", body: JSON.stringify(b) }),
    onSuccess: (_r, values) => {
      setTheme(values.theme);
      client.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Configurações salvas");
    },
  });
  return (
    <form
      className="panel form-grid"
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
    >
      <label>
        Nome da empresa
        <input disabled={!editable} {...form.register("companyName")} />
      </label>
      <label>
        Logotipo (URL HTTPS)
        <input disabled={!editable} {...form.register("logoUrl")} />
      </label>
      <label>
        Tema preferido
        <select disabled={!editable} {...form.register("theme")}>
          <option value="dark">Escuro</option>
          <option value="light">Claro</option>
        </select>
      </label>
      {(
        [
          "linkDays",
          "uploadMb",
          "maxPages",
          "retentionDays",
          "sessionHours",
          "loginAttempts",
        ] as const
      ).map((k, i) => (
        <label key={k}>
          {
            [
              "Validade padrão (dias)",
              "Limite de upload (MB; máximo 3)",
              "Limite de páginas",
              "Retenção mínima (dias)",
              "Duração da sessão (horas)",
              "Tentativas de login por 15 minutos",
            ][i]
          }
          <input
            type="number"
            step={k === "uploadMb" ? 0.1 : 1}
            disabled={!editable}
            {...form.register(k, { valueAsNumber: true })}
          />
          {form.formState.errors[k] && (
            <span className="inline-error">
              {form.formState.errors[k]?.message}
            </span>
          )}
        </label>
      ))}
      <label className="full">
        Mensagem padrão do WhatsApp
        <textarea disabled={!editable} {...form.register("whatsappMessage")} />
        <small className="muted">
          Variáveis: {"{empresa}, {documento}, {link}"}
        </small>
      </label>
      <label className="full">
        Declaração de concordância
        <textarea disabled={!editable} {...form.register("consentText")} />
      </label>
      <label className="check">
        <input
          disabled={!editable}
          type="checkbox"
          {...form.register("compact")}
        />
        Exibição compacta
      </label>
      <p className="full">
        A retenção define a política mínima. Não há exclusão automática de
        documentos; alterações na declaração afetam apenas novas solicitações.
      </p>
      <div className="full">
        <ErrorBox error={save.error} />
        {Object.keys(form.formState.errors).length > 0 && (
          <p role="alert">Revise os valores e URLs do formulário.</p>
        )}
        {editable && (
          <Button disabled={save.isPending}>Salvar configurações</Button>
        )}
      </div>
    </form>
  );
}
function PasswordForm() {
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState("");
  const mutation = useMutation({
    mutationFn: () => post("auth/password", { current, next }),
    onSuccess: () => {
      window.location.assign("/login");
    },
  });
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h2 className="full">Alterar minha senha</h2>
      <label>
        Senha atual
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </label>
      <label>
        Nova senha
        <input
          type="password"
          autoComplete="new-password"
          minLength={9}
          maxLength={128}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </label>
      <div className="full">
        <ErrorBox error={mutation.error} />
        <Button disabled={mutation.isPending}>
          Alterar senha e revogar sessões
        </Button>
      </div>
    </form>
  );
}
export function AuditPage() {
  const [page, setPage] = useState(1),
    [action, setAction] = useState("");
  const data = useQuery({
    queryKey: ["audit", page, action],
    queryFn: () =>
      api<Listing<Event>>(
        `audit/events?page=${page}&action=${encodeURIComponent(action)}`,
      ),
  });
  const check = useMutation({
    mutationFn: () =>
      api<{ valid: boolean; count: number; sequence?: number; head: string }>(
        "audit/integrity",
      ),
  });
  return (
    <>
      <Head
        title="Auditoria"
        text="Eventos imutáveis com encadeamento de hashes autenticados."
      >
        <Button
          variant="secondary"
          disabled={check.isPending}
          onClick={() => check.mutate()}
        >
          <ShieldCheck size={15} />
          Verificar integridade
        </Button>
      </Head>
      {check.data && (
        <div className="notice">
          {check.data.valid
            ? `Cadeia íntegra: ${check.data.count} eventos`
            : `Divergência no evento ${check.data.sequence}`}
        </div>
      )}
      <div className="filters">
        <label>
          Filtrar evento
          <input
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <ErrorBox error={data.error || check.error} />
      {data.isPending ? (
        <Loading />
      ) : data.data?.items.length ? (
        <section className="panel">
          {data.data.items.map((e) => (
            <div className="list-row" key={e.id}>
              <strong>
                #{e.sequence} · {eventLabel(e.action)}
              </strong>
              <small>
                {date(e.created_at)} · {e.actor_name || "Sistema / público"}
              </small>
              <details>
                <summary>Dados e hash</summary>
                <pre className="hash">{JSON.stringify(e.data, null, 2)}</pre>
                <p className="hash">{e.hash}</p>
              </details>
            </div>
          ))}
        </section>
      ) : (
        <Empty text="Os eventos aparecerão conforme o sistema for utilizado." />
      )}
      <Pagination
        page={page}
        total={data.data?.total || 0}
        limit={50}
        onChange={setPage}
      />
    </>
  );
}
