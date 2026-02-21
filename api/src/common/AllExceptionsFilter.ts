import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message:
        exception instanceof HttpException
          ? exception.message
          : "Internal server error",
    };

    if (httpStatus >= 500) {
      if (exception instanceof Error) {
        this.logger.error(exception.message, exception.stack);
      } else {
        this.logger.error(`Unhandled Exception: ${exception}`);
      }
    } else {
      // 4xx errors
      if (exception instanceof Error) {
        this.logger.warn(
          `HTTP Exception: ${exception.message}`,
          exception.stack,
        );
      } else {
        this.logger.warn(`HTTP Exception: ${exception}`);
      }
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
