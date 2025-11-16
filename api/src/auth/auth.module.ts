import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { GithubOAuthStrategy } from "./github.strategy";
import { FortyTwoOAuthStrategy } from "./fortytwo.strategy";
import { UserModule } from "../user/user.module";

@Module({
  imports: [
    ConfigModule,
    UserModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET") || "dev-secret",
        signOptions: {
          expiresIn: "7d",
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GithubOAuthStrategy,
    FortyTwoOAuthStrategy,
  ],
  controllers: [AuthController],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
