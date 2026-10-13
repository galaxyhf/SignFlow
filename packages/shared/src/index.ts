import { z } from "zod";
export const roles = ["admin", "employee", "auditor"] as const;
export type Role = (typeof roles)[number];
export const permissions = [
  "read",
  "clients.write",
  "templates.write",
  "requests.write",
  "reviews.write",
  "users.write",
  "settings.write",
  "audit.read",
] as const;
export type Permission = (typeof permissions)[number];
export const rolePermissions: Record<Role, readonly Permission[]> = {
  admin: permissions,
  employee: [
    "read",
    "clients.write",
    "templates.write",
    "requests.write",
    "reviews.write",
  ],
  auditor: ["read", "audit.read"],
};
export const states = [
  "draft",
  "pending",
  "viewed",
  "filling",
  "processing",
  "signed",
  "reviewed",
  "divergent",
  "refused",
  "expired",
  "cancelled",
  "failed",
] as const;
export type State = (typeof states)[number];
export const stateLabels: Record<State, string> = {
  draft: "Rascunho",
  pending: "Aguardando assinatura",
  viewed: "Visualizado",
  filling: "Em preenchimento",
  processing: "Assinatura em processamento",
  signed: "Assinado — aguardando conferência",
  reviewed: "Conferido",
  divergent: "Dados divergentes",
  refused: "Recusado",
  expired: "Expirado",
  cancelled: "Cancelado",
  failed: "Falha de processamento",
};
const transitions: Record<State, readonly State[]> = {
  draft: ["pending", "cancelled"],
  pending: [
    "viewed",
    "filling",
    "processing",
    "expired",
    "cancelled",
    "refused",
  ],
  viewed: ["filling", "processing", "expired", "cancelled", "refused"],
  filling: ["processing", "expired", "cancelled", "refused"],
  processing: ["signed", "failed"],
  failed: ["processing"],
  signed: ["reviewed", "divergent"],
  reviewed: ["reviewed", "divergent"],
  divergent: ["reviewed", "divergent"],
  refused: [],
  expired: [],
  cancelled: [],
};
export function canTransition(from: State, to: State) {
  return transitions[from].includes(to);
}
export function validTaxId(input: string) {
  const n = input.replace(/\D/g, "");
  if (![11, 14].includes(n.length) || /^(\d)\1+$/.test(n)) return false;
  const digit = (base: string, weights: number[]) => {
    const s = base.split("").reduce((a, c, i) => a + Number(c) * weights[i], 0);
    return (s % 11 < 2 ? 0 : 11 - (s % 11)).toString();
  };
  if (n.length === 11) {
    const a = digit(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return n.endsWith(
      a + digit(n.slice(0, 9) + a, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]),
    );
  }
  const a = digit(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return n.endsWith(
    a + digit(n.slice(0, 12) + a, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]),
  );
}
const text = (max = 255) => z.string().trim().max(max);
export const taxIdSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine(validTaxId, "CPF/CNPJ inválido");
export const cpfSchema = taxIdSchema.refine(
  (n) => n.length === 11,
  "CPF inválido",
);
export const clientSchema = z.object({
  name: text().min(2),
  tradeName: text().default(""),
  taxId: taxIdSchema,
  phone: text(30).default(""),
  whatsapp: z
    .string()
    .max(30)
    .transform((s) => s.replace(/\D/g, ""))
    .default(""),
  internalCode: text(80).min(1),
  notes: text(4000).default(""),
  active: z.boolean().default(true),
});
export const passwordSchema = z
  .string()
  .min(9, "A senha deve ter pelo menos 9 caracteres")
  .max(128, "A senha deve ter no máximo 128 caracteres");
export const registerSchema = z
  .object({
    name: text().min(2, "Informe seu nome"),
    login: text(64)
      .min(3, "O login deve ter pelo menos 3 caracteres")
      .transform((s) => s.toLowerCase()),
    password: passwordSchema,
  })
  .strict();
export const userSchema = z
  .object({
    name: text().min(2),
    login: text()
      .min(3)
      .transform((s) => s.toLowerCase()),
    password: passwordSchema,
    role: z.enum(roles),
    active: z.boolean().default(true),
    permissions: z.array(z.enum(permissions)).default([]),
  })
  .refine(
    (u) =>
      u.role !== "auditor" ||
      u.permissions.every((p) => p === "read" || p === "audit.read"),
    "Auditor só pode consultar",
  );
export const loginSchema = z.object({
  login: text()
    .min(1)
    .transform((s) => s.toLowerCase()),
  password: passwordSchema,
});
export const fieldTypes = [
  "text",
  "name",
  "cpf",
  "cnpj",
  "date",
  "number",
  "phone",
  "textarea",
  "checkbox",
  "select",
  "signature",
] as const;
export const fieldLabels: Record<(typeof fieldTypes)[number], string> = {
  text: "Texto",
  name: "Nome completo",
  cpf: "CPF",
  cnpj: "CNPJ",
  date: "Data",
  number: "Número",
  phone: "Telefone",
  textarea: "Texto longo",
  checkbox: "Checkbox",
  select: "Seleção",
  signature: "Assinatura",
};
export const fieldSchema = z
  .object({
    id: z.uuid(),
    name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
    label: text(100).min(1),
    type: z.enum(fieldTypes),
    page: z.number().int().min(0),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0.02).max(1),
    height: z.number().min(0.015).max(1),
    required: z.boolean(),
    actor: z.enum(["employee", "signer"]),
    defaultValue: text(4000).default(""),
    options: z.array(text(100)).max(50).default([]),
    validation: z
      .object({
        minLength: z.number().int().min(0).max(4000).optional(),
        maxLength: z.number().int().min(1).max(4000).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .default({}),
  })
  .refine(
    (f) => f.x + f.width <= 1.001 && f.y + f.height <= 1.001,
    "Campo fora da página",
  )
  .refine(
    (f) => f.type !== "signature" || f.actor === "signer",
    "Assinatura deve ser do signatário",
  )
  .refine(
    (f) => f.type !== "select" || f.options.length > 0,
    "Seleção precisa de opções",
  );
export type Field = z.infer<typeof fieldSchema>;
export const fieldsSchema = z
  .array(fieldSchema)
  .max(100)
  .refine(
    (fs) =>
      new Set(fs.map((f) => f.id)).size === fs.length &&
      new Set(fs.map((f) => f.name)).size === fs.length,
    "Campos duplicados",
  );
export const templateSchema = z.object({
  name: text().min(2),
  description: text(2000).default(""),
  fileId: z.uuid(),
  standalone: z.boolean().default(false),
  fields: fieldsSchema,
});
export const requestSchema = z.object({
  title: text().min(2),
  clientId: z.uuid(),
  templateVersionId: z.uuid(),
  expectedName: text().min(2),
  expectedCpf: z.union([cpfSchema, z.literal("")]).default(""),
  description: text(4000).default(""),
  ticket: text(100).default(""),
  notes: text(4000).default(""),
  expiresAt: z.iso.datetime({ offset: true }),
  internalValues: z
    .record(z.string(), z.union([z.string().max(4000), z.boolean()]))
    .default({}),
  responsibleId: z.uuid().optional(),
});
export const prepareSchema = z.object({
  name: text().min(2),
  cpf: z.union([cpfSchema, z.literal("")]).default(""),
  values: z.record(z.string(), z.union([z.string().max(4000), z.boolean()])),
  signature: z
    .string()
    .max(350000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/),
});
export const confirmSchema = z.object({
  preparationId: z.uuid(),
  idempotencyKey: z.uuid(),
  accepted: z.literal(true),
  consentVersion: z.string().min(1).max(100),
});
export const reviewSchema = z
  .object({
    result: z.enum(["reviewed", "divergent"]),
    notes: text(4000).default(""),
  })
  .refine(
    (r) => r.result !== "divergent" || r.notes.trim().length >= 5,
    "Informe a justificativa da divergência",
  );
export const settingsSchema = z.object({
  companyName: text(150).min(2),
  logoUrl: z.union([z.url().startsWith("https://"), z.literal("")]).default(""),
  theme: z.enum(["dark", "light"]).default("dark"),
  linkDays: z.number().int().min(1).max(90),
  whatsappMessage: text(2000).min(10),
  consentText: text(4000).min(20),
  retentionDays: z.number().int().min(90).max(36500),
  uploadMb: z.number().positive().max(3),
  maxPages: z.number().int().min(1).max(100),
  sessionHours: z.number().int().min(1).max(24),
  loginAttempts: z.number().int().min(3).max(20),
  compact: z.boolean().default(true),
});
export const defaultSettings: z.infer<typeof settingsSchema> = {
  companyName: "SignFlow",
  logoUrl: "",
  theme: "dark",
  linkDays: 7,
  whatsappMessage:
    "Olá! A {empresa} solicita sua assinatura no documento {documento}. Leia e assine pelo link: {link}",
  consentText:
    "Declaro que li o documento apresentado, concordo com seu conteúdo e desejo assiná-lo eletronicamente.",
  retentionDays: 1825,
  uploadMb: 3,
  maxPages: 30,
  sessionHours: 8,
  loginAttempts: 5,
  compact: true,
};
export function validateValues(
  fields: Field[],
  values: Record<string, string | boolean>,
  actor: "employee" | "signer",
) {
  for (const f of fields.filter(
    (f) => f.actor === actor && f.type !== "signature",
  )) {
    const v = values[f.id] ?? f.defaultValue;
    if (f.required && (v === undefined || v === "" || v === false))
      throw new Error(`${f.label}: campo obrigatório`);
    if (v === "" || v === undefined) continue;
    if (f.type === "checkbox") {
      if (typeof v !== "boolean") throw new Error(`${f.label}: inválido`);
      continue;
    }
    if (typeof v !== "string") throw new Error(`${f.label}: inválido`);
    if (
      (f.type === "cpf" &&
        (v.replace(/\D/g, "").length !== 11 || !validTaxId(v))) ||
      (f.type === "cnpj" &&
        (v.replace(/\D/g, "").length !== 14 || !validTaxId(v)))
    )
      throw new Error(`${f.label}: documento inválido`);
    if (f.type === "select" && !f.options.includes(v))
      throw new Error(`${f.label}: opção inválida`);
    if (
      f.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        !Number.isFinite(Date.parse(v)) ||
        new Date(v).toISOString().slice(0, 10) !== v)
    )
      throw new Error(`${f.label}: data inválida`);
    if (f.type === "phone" && !/^\+?[\d ()-]{8,30}$/.test(v))
      throw new Error(`${f.label}: telefone inválido`);
    if (
      f.type === "number" &&
      (!Number.isFinite(Number(v)) ||
        (f.validation.min !== undefined && Number(v) < f.validation.min) ||
        (f.validation.max !== undefined && Number(v) > f.validation.max))
    )
      throw new Error(`${f.label}: número inválido`);
    if (
      v.length < (f.validation.minLength ?? 0) ||
      v.length > (f.validation.maxLength ?? 4000)
    )
      throw new Error(`${f.label}: tamanho inválido`);
  }
  const allowed = new Set(
    fields
      .filter((f) => f.actor === actor && f.type !== "signature")
      .map((f) => f.id),
  );
  if (Object.keys(values).some((k) => !allowed.has(k)))
    throw new Error("Campo não autorizado");
}
export function whatsappMessage(
  template: string,
  company: string,
  title: string,
  link: string,
) {
  return template
    .replaceAll("{empresa}", company)
    .replaceAll("{documento}", title)
    .replaceAll("{link}", link);
}
