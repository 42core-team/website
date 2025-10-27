import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ConfigService } from "@nestjs/config";

@Controller("auth")
export class AuthController {
  constructor(
    private auth: AuthService,
    private configService: ConfigService,
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
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      return res.redirect(redirectUrl);
    }
    return res.json({ token });
  }

  @Get("/me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return (req as any).user;
  }
}
