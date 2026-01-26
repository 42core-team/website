import type { AxiosResponse } from "axios";
import type { ServerActionResponse } from "@/app/actions/errors";
import axios from "axios";

const axiosInstance = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL || process.env.BACKEND_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  async (config) => {
    if (process.env.BACKEND_URL) {
      console.log("Using BACKEND_URL for axios requests");
      console.log("Backend URL:", process.env.BACKEND_URL);
      // eslint-disable-next-line ts/no-require-imports
      const cookieData = await require("next/headers").cookies();
      const token = cookieData.get("token");
      if (token){
        console.log("Attaching token to request headers", token.value);
        config.headers.Cookie = `token=${token.value}`;
      }else{
        console.log("No token found in cookies");
      }

      config.baseURL = process.env.BACKEND_URL;
      return config;
    }

    console.log("Using NEXT_PUBLIC_BACKEND_PUBLIC_URL for axios requests");
    console.log("Backend URL:", process.env.BACKEND_URL);

    config.baseURL = process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL;

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
