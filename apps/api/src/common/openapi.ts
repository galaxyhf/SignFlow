import { ApiBody, type SchemaObject } from "@nestjs/swagger";
import { z } from "zod";
export function ApiInput(schema: z.ZodType) {
  return ApiBody({
    schema: z.toJSONSchema(schema, {
      io: "input",
      unrepresentable: "any",
    }) as SchemaObject,
  });
}
