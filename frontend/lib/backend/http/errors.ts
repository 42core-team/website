import type { AxiosResponse } from "axios";
import axios from "axios";

export class BackendError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, options?: { status?: number; data?: unknown }) {
    super(message);
    this.name = "BackendError";
    this.status = options?.status;
    this.data = options?.data;
  }
}

function getMessageFromData(data: unknown): string | undefined {
  if (typeof data === "string") {
    return data;
  }

  if (!data || typeof data !== "object") {
    return undefined;
  }

  const message = (data as { message?: unknown }).message;
  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message.filter(item => typeof item === "string").join(", ");
  }

  return undefined;
}

export function normalizeBackendError(
  error: unknown,
  fallbackMessage = "An unexpected error occurred",
): BackendError {
  if (error instanceof BackendError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    return new BackendError(
      getMessageFromData(error.response?.data) || error.message || fallbackMessage,
      {
        status: error.response?.status,
        data: error.response?.data,
      },
    );
  }

  if (error instanceof Error) {
    return new BackendError(error.message || fallbackMessage);
  }

  return new BackendError(fallbackMessage);
}

export function getBackendErrorMessage(
  error: unknown,
  fallbackMessage = "An unexpected error occurred",
) {
  return normalizeBackendError(error, fallbackMessage).message;
}

export function toActionError(
  error: unknown,
  fallbackMessage = "An unexpected error occurred",
) {
  return {
    error: getBackendErrorMessage(error, fallbackMessage),
  };
}

export async function requestData<T>(
  request: Promise<AxiosResponse<T>>,
  fallbackMessage?: string,
): Promise<T> {
  try {
    return (await request).data;
  }
  catch (error) {
    throw normalizeBackendError(error, fallbackMessage);
  }
}
