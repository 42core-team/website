import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../user/user.service";
import { UserId } from "../guards/UserGuard";
import * as CryptoJS from "crypto-js";
import { SocialAccountService } from "../user/social-account.service";
import { SocialPlatform } from "../user/entities/social-account.entity";

@Controller("auth")
export class AuthController {
  constructor(
    private auth: AuthService,
    private configService: ConfigService,
    private userService: UserService,
    private socialAccountService: SocialAccountService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post("login")
  login(@Body() body: { token?: string }, @Res() res: Response) {
    if (!body.token)
      throw new BadRequestException("Token is required for login.");

    res.cookie("token", body.token);
    res.json({ message: "Login successful" });
  }

  @Get("/github/callback")
  @UseGuards(AuthGuard("github"))
  githubCallback(@Req() req: Request, @Res() res: Response) {
    const user: any = (req as any).user;
    const token = this.auth.signToken(user);
    const redirectUrl = this.configService.getOrThrow<string>(
      "OAUTH_SUCCESS_REDIRECT_URL",
    );
    if (redirectUrl) {
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      return res.redirect(redirectUrl);
    }
    return res.json({ token });
  }

  @Get("/42/getUrl")
  @UseGuards(JwtAuthGuard)
  getFortyTwoAuthUrl(@UserId() userId: string) {
    const encryptedUserId = CryptoJS.AES.encrypt(
      userId,
      this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
    ).toString();

    const base64EncodedEncryptedUserId =
      Buffer.from(encryptedUserId).toString("base64");

    return `https://api.intra.42.fr/oauth/authorize?client_id=${this.configService.getOrThrow<string>("FORTYTWO_CLIENT_ID")}&redirect_uri=${encodeURIComponent(this.configService.getOrThrow<string>("FORTYTWO_CALLBACK_URL"))}&response_type=code&state=${base64EncodedEncryptedUserId}`;
  }

  @Get("/42/callback")
  @UseGuards(AuthGuard("42"))
  async fortyTwoCallback(
    @Req()
    request: Request & {
      user: {
        fortyTwoAccount: {
          platformUserId: string;
          username: string;
          email: string;
        };
      };
    },
    @Res() res: Response,
    @Query("state") encryptedUserId: string,
  ) {
    try {
      const base64DecodedEncryptedUserId = Buffer.from(
        encryptedUserId,
        "base64",
      ).toString("utf-8");

      const userId = CryptoJS.AES.decrypt(
        base64DecodedEncryptedUserId,
        this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
      ).toString(CryptoJS.enc.Utf8);
      if (!userId) throw new BadRequestException("Invalid state parameter.");

      await this.socialAccountService.upsertSocialAccountForUser({
        userId,
        platform: SocialPlatform.FORTYTWO,
        platformUserId: request.user.fortyTwoAccount.platformUserId,
        username: request.user.fortyTwoAccount.username,
      });

      const redirectUrl = this.configService.getOrThrow<string>(
        "42_OAUTH_SUCCESS_REDIRECT_URL",
      );

      return res.redirect(redirectUrl);
    } catch (e) {
      console.log("Error in FortyTwo callback: ", e);
      throw new BadRequestException("Invalid state parameter.");
    }
  }

  @Get("/me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    const user: any = (req as any).user;
    return this.userService.getUserById(user.id);
  }
}
