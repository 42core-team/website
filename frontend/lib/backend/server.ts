import { createEventsApi } from "./events";

import { serverHttp } from "./http/server";
import { createSocialAccountsApi } from "./social-accounts";
import { createStatsApi } from "./stats";
import { createTeamsApi } from "./teams";
import { createTournamentApi } from "./tournament";
import { createUsersApi } from "./users";
import "server-only";

export const serverEventsApi = createEventsApi(serverHttp);
export const serverTeamsApi = createTeamsApi(serverHttp);
export const serverTournamentApi = createTournamentApi(serverHttp);
export const serverUsersApi = createUsersApi(serverHttp);
export const serverSocialAccountsApi = createSocialAccountsApi(serverHttp);
export const serverStatsApi = createStatsApi(serverHttp);
