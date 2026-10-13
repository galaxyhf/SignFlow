import { Injectable, Inject, ConflictException } from "@nestjs/common";
import { reviewSchema, canTransition } from "@signflow/shared";
import { Database } from "../../database/database";
import { DocumentsRepository } from "./documents.repository";
import { AuditService } from "../audit/audit.service";
@Injectable()
export class ReviewsService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(DocumentsRepository) private repo: DocumentsRepository,
    @Inject(AuditService) private audit: AuditService,
  ) {}
  async record(id: string, input: unknown, actor: string) {
    const b = reviewSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const r = await this.repo.get(id, tx, true);
      if (!canTransition(r.status, b.result))
        throw new ConflictException("Documento ainda não pode ser conferido");
      await tx.query(
        "INSERT INTO identity_reviews(request_id,reviewer_id,result,notes) VALUES($1,$2,$3,$4)",
        [id, actor, b.result, b.notes],
      );
      await tx.query(
        "UPDATE signature_requests SET status=$2,updated_at=now() WHERE id=$1",
        [id, b.result],
      );
      await this.audit.append(tx, "review.recorded", id, actor, {
        result: b.result,
        notes: b.notes,
      });
      return { success: true };
    });
  }
}
