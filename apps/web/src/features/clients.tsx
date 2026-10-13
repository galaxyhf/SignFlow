"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema } from "@signflow/shared";
import type { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, ArrowLeft } from "lucide-react";
import { api, Actor, Client, Listing } from "../lib/api";
import { Button } from "../components/ui/button";
import {
  Head,
  ErrorBox,
  Loading,
  Empty,
  Pagination,
} from "../components/common";
export function Clients({ user }: { user: Actor }) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [active, setActive] = useState(""),
    [sort, setSort] = useState("name"),
    [editing, setEditing] = useState<Client | null | undefined>(undefined);
  const client = useQueryClient();
  const data = useQuery({
    queryKey: ["clients", search, page, active, sort],
    queryFn: () =>
      api<Listing<Client>>(
        `clients?${new URLSearchParams({ search, page: String(page), active, sort })}`,
      ),
  });
  const allowed = user.permissions.includes("clients.write");
  if (editing !== undefined)
    return (
      <ClientForm
        client={editing}
        done={() => {
          setEditing(undefined);
          client.invalidateQueries({ queryKey: ["clients"] });
        }}
      />
    );
  return (
    <>
      <Head
        title="Clientes"
        text="Cadastro interno e histórico de autorizações."
      >
        {allowed && (
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} />
            Cadastrar cliente
          </Button>
        )}
      </Head>
      <div className="filters">
        <label>
          Pesquisar
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Nome, CPF/CNPJ ou código"
          />
        </label>
        <label>
          Status
          <select
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </label>
        <label>
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Nome</option>
            <option value="created">Mais recentes</option>
          </select>
        </label>
      </div>
      <ErrorBox error={data.error} retry={() => data.refetch()} />
      {data.isPending ? (
        <Loading />
      ) : data.data?.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CPF/CNPJ</th>
                <th>Código interno</th>
                <th>WhatsApp</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    <small>{c.trade_name}</small>
                  </td>
                  <td>{c.tax_id}</td>
                  <td>{c.internal_code}</td>
                  <td>{c.whatsapp || "—"}</td>
                  <td>{c.active ? "Ativo" : "Inativo"}</td>
                  <td>
                    <div className="actions">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/documentos?client=${c.id}`}>
                          Histórico
                        </Link>
                      </Button>
                      {allowed && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditing(c)}
                        >
                          <Pencil size={13} />
                          Editar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Nenhum cliente encontrado"
          text="Cadastre clientes para associar solicitações e conferir os dados informados."
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
function ClientForm({
  client,
  done,
}: {
  client: Client | null;
  done: () => void;
}) {
  const form = useForm<
    z.input<typeof clientSchema>,
    unknown,
    z.output<typeof clientSchema>
  >({
    resolver: zodResolver(clientSchema),
    defaultValues: client
      ? {
          name: client.name,
          tradeName: client.trade_name,
          taxId: client.tax_id,
          phone: client.phone,
          whatsapp: client.whatsapp,
          internalCode: client.internal_code,
          notes: client.notes,
          active: client.active,
        }
      : { active: true },
  });
  const mutation = useMutation({
    mutationFn: (v: z.output<typeof clientSchema>) =>
      api(`clients${client ? "/" + client.id : ""}`, {
        method: client ? "PATCH" : "POST",
        body: JSON.stringify(v),
      }),
    onSuccess: () => {
      toast.success("Cliente salvo");
      done();
    },
  });
  return (
    <>
      <Head title={client ? "Editar cliente" : "Cadastrar cliente"}>
        <Button variant="secondary" onClick={done}>
          <ArrowLeft size={15} />
          Voltar
        </Button>
      </Head>
      <form
        className="panel form-grid"
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      >
        {(
          [
            "name",
            "tradeName",
            "taxId",
            "internalCode",
            "phone",
            "whatsapp",
          ] as const
        ).map((key, i) => (
          <label key={key}>
            {
              [
                "Nome ou razão social",
                "Nome fantasia",
                "CPF/CNPJ",
                "Código interno",
                "Telefone",
                "WhatsApp",
              ][i]
            }
            <input {...form.register(key)} />
            {form.formState.errors[key] && (
              <span className="inline-error">
                {form.formState.errors[key]?.message}
              </span>
            )}
          </label>
        ))}
        <label className="full">
          Observações
          <textarea {...form.register("notes")} />
        </label>
        <label className="check">
          <input type="checkbox" {...form.register("active")} />
          Cliente ativo
        </label>
        <div className="full">
          <ErrorBox error={mutation.error} />
          <Button disabled={mutation.isPending}>Salvar cliente</Button>
        </div>
      </form>
    </>
  );
}
