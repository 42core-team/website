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

export default axiosInstance;
