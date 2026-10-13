import { ApiBody } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { z } from "zod";
export function ApiInput(schema: z.ZodType) {
  return ApiBody({
    schema: z.toJSONSchema(schema, {
      io: "input",
      unrepresentable: "any",
    }) as SchemaObject,
  });
}
