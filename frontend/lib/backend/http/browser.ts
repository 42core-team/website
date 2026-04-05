import axios from "axios";

function getBrowserBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL;
}

export const browserHttp = axios.create({
  baseURL: getBrowserBackendBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

browserHttp.interceptors.request.use((config) => {
  const baseUrl = getBrowserBackendBaseUrl();

  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_PUBLIC_URL");
  }

  config.baseURL = baseUrl;

  return config;
});
