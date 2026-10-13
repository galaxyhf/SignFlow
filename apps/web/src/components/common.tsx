"use client";
import { Button } from "./ui/button";
import { stateLabels, State } from "@signflow/shared";
export function ErrorBox({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      {error.message}
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
export function Loading() {
  return <div aria-busy="true" aria-label="Carregando" className="skeleton" />;
}
export function Empty({
  title = "Nenhum registro encontrado",
  text = "Cadastre o primeiro registro para começar.",
  children,
}: {
  title?: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p style={{ margin: "10px auto 20px" }}>{text}</p>
      {children}
    </div>
  );
}
export function Status({ value }: { value: State }) {
  return (
    <span className={`status ${value}`}>{stateLabels[value] || value}</span>
  );
}
export function Pagination({
  page,
  total,
  onChange,
  limit = 20,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
  limit?: number;
}) {
  return (
    <div className="pagination">
      <span>
        {total} registro{total === 1 ? "" : "s"} · Página {page}
      </span>
      <div className="actions">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="secondary"
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
export function Head({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
