import axios, { AxiosResponse } from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/utils/authOptions";
import { ServerActionResponse } from "@/app/actions/errors";

const axiosInstance = axios.create({
  baseURL: process.env.BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  async (config) => {
    if (!process.env.BACKEND_SECRET) {
      config.baseURL = process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL;
      return config;
    }

    if (config.url && config.url.startsWith("user/email/")) {
      return config;
    }
    const session = await getServerSession(authOptions);
    config.headers.userId = session?.user?.id || "";
    return config;
  },
  (error) => {
    // Handle request errors
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
