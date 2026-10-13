import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { ZodError } from "zod";
import { Response } from "express";
import pino from "pino";
const logger = pino({ base: { service: "signflow-api" } });
@Catch()
export class ErrorsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500,
      message = "Não foi possível concluir a operação";
    if (error instanceof ZodError) {
      status = 400;
      message = error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.message;
    } else if (error && typeof error === "object" && "code" in error) {
      if (error.code === "23505") {
        status = 409;
        message = "Registro duplicado";
      }
      if (error.code === "23503") {
        status = 400;
        message = "Registro associado inválido";
      }
    }
    if (status === 500)
      logger.error(
        { type: error instanceof Error ? error.name : "Unknown" },
        "Falha interna",
      );
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ message, status });
  }
}
