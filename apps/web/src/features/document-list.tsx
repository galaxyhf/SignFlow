"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { states, stateLabels } from "@signflow/shared";
import { api, Actor, DocumentRecord, Listing, date } from "../lib/api";
import { Button } from "../components/ui/button";
import {
  Head,
  ErrorBox,
  Loading,
  Empty,
  Pagination,
  Status,
} from "../components/common";

export function Documents({ user }: { user: Actor }) {
  return (
    <Suspense fallback={<Loading />}>
      <DocumentList user={user} />
    </Suspense>
  );
}
function DocumentList({ user }: { user: Actor }) {
  const params = useSearchParams();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(params.get("status") || "");
  const query = new URLSearchParams({
    search,
    page: String(page),
    status,
    client: params.get("client") || "",
    from: params.get("from") || "",
    to: params.get("to") || "",
    responsible: params.get("responsible") || "",
  });
  const data = useQuery({
    queryKey: ["documents", query.toString()],
    queryFn: () => api<Listing<DocumentRecord>>(`documents?${query}`),
  });
  return (
    <>
      <Head
        title="Documentos"
        text="Solicitações, assinaturas e conferência em um só lugar."
      >
        {user.permissions.includes("requests.write") && (
          <Button asChild>
            <Link href="/documentos/novo">
              <Plus size={16} />
              Nova solicitação
            </Link>
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
            placeholder="Documento, cliente ou chamado"
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os estados</option>
            {states.map((s) => (
              <option value={s} key={s}>
                {stateLabels[s]}
              </option>
            ))}
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
                <th>Documento</th>
                <th>Cliente</th>
                <th>Chamado</th>
                <th>Status</th>
                <th>Validade</th>
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/documentos/${d.id}`}>{d.title}</Link>
                    <small>{date(d.created_at)}</small>
                  </td>
                  <td>{d.client_name}</td>
                  <td>{d.ticket || "—"}</td>
                  <td>
                    <Status value={d.status} />
                  </td>
                  <td>{date(d.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Nenhuma solicitação encontrada"
          text="Crie uma solicitação a partir de um modelo ou de um PDF avulso."
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
