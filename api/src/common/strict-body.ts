import { ValidationPipe } from "@nestjs/common";

/**
 * Validates a body and hands the handler the transformed DTO, rejecting
 * properties the DTO does not declare. The global ValidationPipe neither
 * transforms nor strips, which nested DTOs stored as they are need.
 */
export function strictBody() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}
