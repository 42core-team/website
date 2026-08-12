import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { GithubOAuthClient } from "./github.strategy";
import { FortyTwoOAuthStrategy } from "./fortytwo.strategy";
import { UserModule } from "../user/user.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OAuthStateEntity } from "./entities/oauth-state.entity";
import { OAuthStateService } from "./oauth-state.service";
import { FortyTwoOAuthStateGuard } from "./fortytwo-oauth-state.guard";

@Module({
  imports: [
    ConfigModule,
    UserModule,
    TypeOrmModule.forFeature([OAuthStateEntity]),
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: "30d",
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    GithubOAuthClient,
    FortyTwoOAuthStrategy,
    OAuthStateService,
    FortyTwoOAuthStateGuard,
  ],
  controllers: [AuthController],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
