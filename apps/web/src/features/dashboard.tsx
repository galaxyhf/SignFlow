"use client";
import { eventLabel } from "../lib/events";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight } from "lucide-react";
import { states, State, stateLabels } from "@signflow/shared";
import { api, Actor, DocumentRecord, date } from "../lib/api";
import { Button } from "../components/ui/button";
import { Head, ErrorBox, Loading, Empty, Status } from "../components/common";
type DashboardData = {
  total: number;
  counts: { status: State; count: number }[];
  recent: DocumentRecord[];
  activities: { action: string; actor_name: string; created_at: string }[];
  evolution: { day: string; count: number }[];
};
export function Dashboard({ user }: { user: Actor }) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [responsible, setResponsible] = useState("");
  const params = new URLSearchParams({ from, to, responsible });
  const data = useQuery({
    queryKey: ["dashboard", from, to, responsible],
    queryFn: () => api<DashboardData>(`dashboard?${params}`),
  });
  const people = useQuery({
    queryKey: ["responsibles"],
    queryFn: () => api<{ id: string; name: string }[]>("users/responsibles"),
  });
  return (
    <>
      <Head
        title="Visão geral"
        text="Acompanhe o fluxo de autorizações da sua equipe."
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
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Responsável
          <select
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
          >
            <option value="">Todos</option>
            {people.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorBox error={data.error} retry={() => data.refetch()} />
      {data.isPending ? (
        <Loading />
      ) : (
        data.data && (
          <>
            <div className="metrics">
              <Link className="metric" href={`/documentos?${params}`}>
                <strong>{data.data.total}</strong>
                <span>Total de solicitações</span>
              </Link>
              {states
                .filter((s) => s !== "draft")
                .map((s) => (
                  <Link
                    className="metric"
                    href={`/documentos?${params}&status=${s}`}
                    key={s}
                  >
                    <strong>
                      {data.data!.counts.find((c) => c.status === s)?.count ||
                        0}
                    </strong>
                    <span>{stateLabels[s]}</span>
                  </Link>
                ))}
            </div>
            <div className="split">
              <section className="panel">
                <h2>Solicitações recentes</h2>
                {!data.data.recent.length ? (
                  <Empty text="Crie uma solicitação para acompanhar seu progresso." />
                ) : (
                  data.data.recent.map((d) => (
                    <Link
                      className="list-row"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                      href={`/documentos/${d.id}`}
                      key={d.id}
                    >
                      <div>
                        {d.title}
                        <small>
                          {d.client_name} · {d.ticket || "Sem chamado"}
                        </small>
                      </div>
                      <Status value={d.status} />
                    </Link>
                  ))
                )}
                <Button asChild variant="ghost">
                  <Link href="/documentos">
                    Ver todos
                    <ArrowUpRight size={15} />
                  </Link>
                </Button>
              </section>
              <section className="panel">
                <h2>Assinaturas por dia</h2>
                {data.data.evolution.length ? (
                  <>
                    <div className="chart" aria-label="Evolução de assinaturas">
                      {data.data.evolution.map((d) => (
                        <div
                          key={d.day}
                          title={`${d.day}: ${d.count} assinatura(s)`}
                          style={{
                            height: `${Math.max(8, (d.count / Math.max(...data.data!.evolution.map((x) => x.count))) * 100)}%`,
                          }}
                        />
                      ))}
                    </div>
                    <details>
                      <summary>Consultar valores</summary>
                      {data.data.evolution.map((d) => (
                        <div key={d.day}>
                          {d.day}: {d.count}
                        </div>
                      ))}
                    </details>
                  </>
                ) : (
                  <Empty
                    title="Sem assinaturas no período"
                    text="As assinaturas concluídas aparecerão aqui."
                  />
                )}
              </section>
            </div>
            <section className="panel">
              <h2>Atividade recente</h2>
              {data.data.activities.length ? (
                data.data.activities.map((a, i) => (
                  <div className="list-row" key={i}>
                    {eventLabel(a.action)}
                    <small>
                      {a.actor_name || "Sistema / signatário"} ·{" "}
                      {date(a.created_at)}
                    </small>
                  </div>
                ))
              ) : (
                <Empty text="Os eventos são registrados conforme a equipe utiliza o sistema." />
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
