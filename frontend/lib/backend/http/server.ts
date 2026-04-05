import axios, { AxiosHeaders } from "axios";

import { cookies } from "next/headers";
import "server-only";

function getServerBackendBaseUrl() {
  return process.env.BACKEND_URL;
}

export const serverHttp = axios.create({
  baseURL: getServerBackendBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

serverHttp.interceptors.request.use(async (config) => {
  const baseUrl = getServerBackendBaseUrl();
  if (!baseUrl) {
    throw new Error("Missing BACKEND_URL");
  }

  const cookieStore = await cookies();
  const cookieName = process.env.AUTH_COOKIE_NAME || "token";
  const authCookie = cookieStore.get(cookieName);

  config.baseURL = baseUrl;
  const headers = AxiosHeaders.from(config.headers);

  if (authCookie) {
    headers.set("Cookie", `${cookieName}=${authCookie.value}`);
  }

  config.headers = headers;

  return config;
});
