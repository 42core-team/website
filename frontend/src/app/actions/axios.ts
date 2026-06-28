import type { AxiosResponse } from "axios";
import type { ServerActionResponse } from "@/app/actions/errors";
import axios from "axios";
import { getBackendBaseUrl } from "@/lib/env";

const axiosInstance = axios.create({
  baseURL: getBackendBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    config.baseURL = getBackendBaseUrl();
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
  }
  catch (error: any) {
    return {
      error: error.response?.data?.message || "An unexpected error occurred",
    };
  }
}

export default axiosInstance;
