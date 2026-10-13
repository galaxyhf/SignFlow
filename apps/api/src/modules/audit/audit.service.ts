import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Queryable } from "../../database/database";
import { canonical, hmac } from "../../common/crypto";
import { secret } from "../../config/env";
@Injectable()
export class AuditService {
  async append(
    tx: Queryable,
    action: string,
    aggregateId: string | null,
    actorId: string | null,
    data: Record<string, unknown> = {},
  ) {
    await tx.query("SELECT pg_advisory_xact_lock(718291)");
    const prev = (
      await tx.query<{ sequence: number; hash: string }>(
        "SELECT sequence,hash FROM audit_events ORDER BY sequence DESC LIMIT 1",
      )
    ).rows[0];
    const event = {
      id: randomUUID(),
      sequence: (prev?.sequence ?? 0) + 1,
      aggregateId,
      actorId,
      action,
      data,
      previousHash: prev?.hash ?? "GENESIS",
      createdAt: new Date().toISOString(),
    };
    const hash = hmac(secret("EVIDENCE_SECRET"), event);
    await tx.query(
      "INSERT INTO audit_events(id,sequence,aggregate_id,actor_id,action,data,previous_hash,hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        event.id,
        event.sequence,
        aggregateId,
        actorId,
        action,
        canonical(data),
        event.previousHash,
        hash,
        event.createdAt,
      ],
    );
    return { ...event, hash };
  }
  async verify(tx: Queryable) {
    const events = (
      await tx.query("SELECT * FROM audit_events ORDER BY sequence")
    ).rows;
    let previous = "GENESIS";
    for (const e of events) {
      const event = {
        id: e.id,
        sequence: e.sequence,
        aggregateId: e.aggregate_id,
        actorId: e.actor_id,
        action: e.action,
        data: e.data,
        previousHash: e.previous_hash,
        createdAt: new Date(e.created_at as string | Date).toISOString(),
      };
      if (
        e.previous_hash !== previous ||
        hmac(secret("EVIDENCE_SECRET"), event) !== e.hash
      )
        return { valid: false, sequence: e.sequence };
      previous = String(e.hash);
    }
    return { valid: true, count: events.length, head: previous };
  }
}
