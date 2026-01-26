declare module "passport-oauth2" {
  import { Strategy as PassportStrategy } from "passport";

  export interface StrategyOptions {
    authorizationURL: string;
    tokenURL: string;
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  }

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify?: any);
  }
}
