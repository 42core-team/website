import axios, { AxiosResponse } from "axios";
import { ServerActionResponse } from "@/app/actions/errors";

const axiosInstance = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL || process.env.BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

function getTokenFromCookieString(cookieString: string): string | null {
  const parts = cookieString.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "token") return decodeURIComponent(rest.join("="));
  }
  return null;
}

axiosInstance.interceptors.request.use(
  async (config) => {
    if (process.env.BACKEND_URL) {
      const cookieData = await require("next/headers").cookies();
      const token = cookieData.get("token");
      if (token) config.headers.Authorization = `Bearer ${token.value}`;

      config.baseURL = process.env.BACKEND_URL;
      return config;
    }

    config.baseURL = process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL;
    config.headers.Authorization = getTokenFromCookieString(
      document.cookie || "",
    );
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export async function handleError<T>(
  promise: Promise<AxiosResponse<T>>,
): Promise<ServerActionResponse<T>> {
  try {
    const response = await promise;
    return response.data;
  } catch (error: any) {
    return {
      error: error.response?.data?.message || "An unexpected error occurred",
    };
  }
}

export default axiosInstance;
