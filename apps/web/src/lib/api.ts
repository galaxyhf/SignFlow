export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const csrf =
    typeof document === "undefined"
      ? ""
      : document.cookie
          .split("; ")
          .find((c) => c.startsWith("sf_csrf="))
          ?.split("=")[1];
  const form = init.body instanceof FormData;
  const res = await fetch(`/api/${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(form ? {} : { "Content-Type": "application/json" }),
      ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Serviço indisponível" }));
    throw new ApiError(
      error.message || "Não foi possível concluir",
      res.status,
    );
  }
  return res.json();
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export type Actor = {
  id: string;
  name: string;
  login: string;
  role: string;
  permissions: string[];
};
export type Client = {
  id: string;
  name: string;
  trade_name: string;
  tax_id: string;
  phone: string;
  whatsapp: string;
  internal_code: string;
  notes: string;
  active: boolean;
};
export type Listing<T> = { items: T[]; total: number; page: number };
export type Template = {
  id: string;
  name: string;
  description: string;
  version_id: string;
  file_id: string;
  version: number;
  versions: Version[];
};
import type { Field, State } from "@signflow/shared";
export type Version = {
  id: string;
  file_id: string;
  version: number;
  fields: Field[];
};
export type Signature = {
  id: string;
  name: string;
  cpf: string;
  accepted_at: string;
  signed_at: string;
  ip: string;
  user_agent: string;
  consent_text: string;
  consent_version: string;
  final_file_id: string;
  signature_file_id: string;
};
export type Event = {
  id: string;
  sequence: number;
  action: string;
  data: Record<string, unknown>;
  hash: string;
  previous_hash: string;
  created_at: string;
  actor_name: string | null;
};
export type Review = {
  id: string;
  result: State;
  notes: string;
  reviewer_name: string;
  created_at: string;
};
export type DocumentRecord = {
  id: string;
  title: string;
  description: string;
  ticket: string;
  notes: string;
  client_id: string;
  client_name: string;
  tax_id: string;
  whatsapp: string;
  internal_code: string;
  expected_name: string;
  expected_cpf: string;
  responsible_id: string;
  created_at: string;
  expires_at: string;
  status: State;
  template_version_id: string;
  original_file_id: string;
  presented_file_id: string;
  fields: Field[];
  internal_values: Record<string, string | boolean>;
  signature: Signature | null;
  history: Event[];
  reviews: Review[];
  evidence: {
    file_id: string;
    manifest: Record<string, unknown>;
    hmac: string;
  } | null;
};
export const date = (v: string) => new Date(v).toLocaleString("pt-BR");
