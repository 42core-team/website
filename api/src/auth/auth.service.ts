import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserEntity } from "../user/entities/user.entity";

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  signToken(user: UserEntity) {
    const payload = { sub: user.id, email: user.email, username: user.username };
    return this.jwt.sign(payload);
  }
}
