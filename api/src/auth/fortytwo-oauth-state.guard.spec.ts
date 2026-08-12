import { BadRequestException, ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuthFlow } from "./entities/oauth-state.entity";
import {
  FORTYTWO_OAUTH_COOKIE,
  FortyTwoOAuthStateGuard,
} from "./fortytwo-oauth-state.guard";
import { OAuthStateService } from "./oauth-state.service";

describe("FortyTwoOAuthStateGuard", () => {
  it("rejects a callback without the initiating browser cookie", async () => {
    const oauthStates = {
      consume: jest.fn().mockRejectedValue(new BadRequestException()),
    } as unknown as OAuthStateService;
    const guard = new FortyTwoOAuthStateGuard(oauthStates, {
      get: jest.fn().mockReturnValue("development"),
    } as unknown as ConfigService);
    const request = { query: { state: "state-a" }, cookies: {} };
    const response = { clearCookie: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(oauthStates.consume).toHaveBeenCalledWith(
      OAuthFlow.FORTYTWO,
      "state-a",
      undefined,
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      FORTYTWO_OAUTH_COOKIE,
      expect.any(Object),
    );
  });
});
