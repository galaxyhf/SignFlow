import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Field } from "@signflow/shared";
const id = () => uuid("id").primaryKey().defaultRandom();
const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  login: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  active: boolean().notNull().default(true),
  createdAt: created(),
  updatedAt: updated(),
});
export const roles = pgTable("roles", { name: text().primaryKey() });
export const permissions = pgTable("permissions", {
  name: text().primaryKey(),
});
export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: text()
      .notNull()
      .references(() => roles.name),
    permission: text()
      .notNull()
      .references(() => permissions.name),
  },
  (t) => [primaryKey({ columns: [t.role, t.permission] })],
);
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text()
      .notNull()
      .references(() => roles.name),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);
export const userPermissions = pgTable(
  "user_permissions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    permission: text()
      .notNull()
      .references(() => permissions.name),
  },
  (t) => [primaryKey({ columns: [t.userId, t.permission] })],
);
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    csrfHash: text("csrf_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
export const clients = pgTable(
  "clients",
  {
    id: id(),
    name: text().notNull(),
    tradeName: text("trade_name").notNull().default(""),
    taxId: text("tax_id").notNull().unique(),
    phone: text().notNull().default(""),
    whatsapp: text().notNull().default(""),
    internalCode: text("internal_code").notNull().unique(),
    notes: text().notNull().default(""),
    active: boolean().notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);
export const documentFiles = pgTable(
  "document_files",
  {
    id: id(),
    key: text().notNull().unique(),
    kind: text().notNull(),
    sha256: text().notNull(),
    bytes: integer().notNull(),
    pages: integer().notNull().default(0),
    ownerId: uuid("owner_id").references(() => users.id),
    createdAt: created(),
  },
  (t) => [index("files_hash_idx").on(t.sha256)],
);
export const documentTemplates = pgTable("document_templates", {
  id: id(),
  name: text().notNull(),
  description: text().notNull().default(""),
  active: boolean().notNull().default(true),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: created(),
  updatedAt: updated(),
});
export const templateVersions = pgTable(
  "template_versions",
  {
    id: id(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => documentTemplates.id),
    version: integer().notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => documentFiles.id),
    fields: jsonb().$type<Field[]>().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: created(),
  },
  (t) => [uniqueIndex("template_version_uq").on(t.templateId, t.version)],
);
export const templateFields = pgTable(
  "template_fields",
  {
    id: id(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => templateVersions.id),
    fieldId: uuid("field_id").notNull(),
    definition: jsonb().$type<Field>().notNull(),
  },
  (t) => [uniqueIndex("template_field_uq").on(t.versionId, t.fieldId)],
);
export const documents = pgTable(
  "documents",
  {
    id: id(),
    title: text().notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    responsibleId: uuid("responsible_id")
      .notNull()
      .references(() => users.id),
    description: text().notNull().default(""),
    ticket: text().notNull().default(""),
    notes: text().notNull().default(""),
    createdAt: created(),
  },
  (t) => [
    index("documents_ticket_idx").on(t.ticket),
    index("documents_client_idx").on(t.clientId),
  ],
);
export const documentVersions = pgTable(
  "document_versions",
  {
    id: id(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    templateVersionId: uuid("template_version_id")
      .notNull()
      .references(() => templateVersions.id),
    version: integer().notNull().default(1),
    originalFileId: uuid("original_file_id")
      .notNull()
      .references(() => documentFiles.id),
    presentedFileId: uuid("presented_file_id")
      .notNull()
      .references(() => documentFiles.id),
    fields: jsonb().$type<Field[]>().notNull(),
    internalValues: jsonb("internal_values").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("document_version_uq").on(t.documentId, t.version)],
);
export const signatureRequests = pgTable(
  "signature_requests",
  {
    id: id(),
    documentVersionId: uuid("document_version_id")
      .notNull()
      .references(() => documentVersions.id)
      .unique(),
    tokenHash: text("token_hash").notNull().unique(),
    status: text().notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    consentText: text("consent_text").notNull(),
    consentVersion: text("consent_version").notNull(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("request_status_idx").on(t.status),
    check(
      "request_state_check",
      sql`${t.status} in ('draft','pending','viewed','filling','processing','signed','reviewed','divergent','refused','expired','cancelled','failed')`,
    ),
  ],
);
export const signers = pgTable("signers", {
  id: id(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => signatureRequests.id)
    .unique(),
  expectedName: text("expected_name").notNull(),
  expectedCpf: text("expected_cpf").notNull().default(""),
});
export const preparations = pgTable("signing_preparations", {
  id: id(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => signatureRequests.id),
  payload: jsonb().notNull(),
  presentedHash: text("presented_hash").notNull(),
  consentVersion: text("consent_version").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
});
export const signatures = pgTable("signatures", {
  id: id(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => signatureRequests.id)
    .unique(),
  preparationId: uuid("preparation_id")
    .notNull()
    .references(() => preparations.id),
  idempotencyKey: uuid("idempotency_key").notNull().unique(),
  name: text().notNull(),
  cpf: text().notNull().default(""),
  signatureFileId: uuid("signature_file_id").references(() => documentFiles.id),
  finalFileId: uuid("final_file_id").references(() => documentFiles.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  ip: text().notNull(),
  userAgent: text("user_agent").notNull(),
  consentText: text("consent_text").notNull(),
  consentVersion: text("consent_version").notNull(),
  createdAt: created(),
});
export const signatureFieldValues = pgTable(
  "signature_field_values",
  {
    id: id(),
    signatureId: uuid("signature_id")
      .notNull()
      .references(() => signatures.id),
    fieldId: uuid("field_id").notNull(),
    value: jsonb().notNull(),
  },
  (t) => [uniqueIndex("signature_field_uq").on(t.signatureId, t.fieldId)],
);
export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    sequence: integer().notNull().unique(),
    aggregateId: uuid("aggregate_id"),
    actorId: uuid("actor_id").references(() => users.id),
    action: text().notNull(),
    data: jsonb().notNull(),
    previousHash: text("previous_hash").notNull(),
    hash: text().notNull().unique(),
    createdAt: created(),
  },
  (t) => [index("audit_aggregate_idx").on(t.aggregateId)],
);
export const evidencePackages = pgTable("evidence_packages", {
  id: id(),
  signatureId: uuid("signature_id")
    .notNull()
    .references(() => signatures.id)
    .unique(),
  fileId: uuid("file_id")
    .notNull()
    .references(() => documentFiles.id),
  manifest: jsonb().notNull(),
  hmac: text().notNull(),
  createdAt: created(),
});
export const identityReviews = pgTable(
  "identity_reviews",
  {
    id: id(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => signatureRequests.id),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id),
    result: text().notNull(),
    notes: text().notNull(),
    createdAt: created(),
  },
  (t) => [
    index("review_request_idx").on(t.requestId),
    check("review_result_check", sql`${t.result} in ('reviewed','divergent')`),
  ],
);
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: updated(),
});
export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: id(),
    signatureId: uuid("signature_id")
      .notNull()
      .references(() => signatures.id)
      .unique(),
    status: text().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    error: text(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("jobs_status_idx").on(t.status, t.nextRunAt)],
);
