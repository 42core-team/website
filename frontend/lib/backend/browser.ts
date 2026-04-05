import { createEventsApi } from "./events";
import { browserHttp } from "./http/browser";
import { createSocialAccountsApi } from "./social-accounts";
import { createStatsApi } from "./stats";
import { createTeamsApi } from "./teams";
import { createTournamentApi } from "./tournament";
import { createUsersApi } from "./users";

export const browserEventsApi = createEventsApi(browserHttp);
export const browserTeamsApi = createTeamsApi(browserHttp);
export const browserTournamentApi = createTournamentApi(browserHttp);
export const browserUsersApi = createUsersApi(browserHttp);
export const browserSocialAccountsApi = createSocialAccountsApi(browserHttp);
export const browserStatsApi = createStatsApi(browserHttp);
