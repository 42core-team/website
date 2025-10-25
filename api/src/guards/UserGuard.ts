import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { ConfigService } from "@nestjs/config";

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.userId;
  },
);

@Injectable()
export class UserGuard implements CanActivate {
  FRONTEND_SECRET: string;

  constructor(private readonly config: ConfigService) {
    this.FRONTEND_SECRET = config.getOrThrow("FRONTEND_SECRET");
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    const authorization = request.headers.authorization;
    if (authorization !== this.FRONTEND_SECRET)
      throw new UnauthorizedException();

    const userId = request.headers["userid"];
    if (!userId) throw new UnauthorizedException("User ID is required");
    request.userId = userId;

    return true;
  }
}
