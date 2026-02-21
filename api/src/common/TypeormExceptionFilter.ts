import { EntityNotFoundError } from "typeorm";
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response, Request } from "express";

@Catch(EntityNotFoundError)
export class TypeormExceptionFilter implements ExceptionFilter {
  catch(exception: EntityNotFoundError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Log the error
    Logger.error(
      `Entity not found for request ${request.method} ${request.url}`,
      exception.stack,
      "TypeormExceptionFilter",
    );

    response.status(HttpStatus.NOT_FOUND).json({
      statusCode: HttpStatus.NOT_FOUND,
      timestamp: new Date().toISOString(),
      message: "Entity not found",
      error: exception.message,
    });
  }
}
