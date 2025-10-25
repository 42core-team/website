import { RequestOptions, ResponseHeaders } from "./types";
import { Logger } from "@nestjs/common";

/**
 * GitHub API Client with rate limiting and automatic retries
 * Implements best practices from GitHub documentation:
 * https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
 */
export class GitHubApiClient {
  private baseUrl: string;
  private token: string | null;
  private userAgent: string;
  private maxRetries: number;
  private readonly logger = new Logger(GitHubApiClient.name);

  /**
   * Create a new GitHub API client
   * @param options Configuration options for the client
   */
  constructor(
    options: {
      baseUrl?: string;
      token?: string;
      userAgent?: string;
      maxRetries?: number;
    } = {},
  ) {
    this.baseUrl = options.baseUrl || "https://api.github.com";
    this.token = options.token || null;
    this.userAgent = options.userAgent || "GitHub-API-Client";
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Make a request to the GitHub API with automatic rate limit handling
   * @param endpoint API endpoint (without base URL)
   * @param options Request options
   * @returns Response data
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options.params);
    const headers = this.buildHeaders(options.headers);
    const method = options.method || "GET";
    const body = options.body ? JSON.stringify(options.body) : undefined;

    let retries = 0;
    while (true) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
        });

        // Handle rate limiting
        if (
          (response.status === 403 || response.status === 429) &&
          this.isRateLimited(response.headers)
        ) {
          const resetTime = this.getRateLimitResetTime(response.headers);
          const waitTime = this.calculateWaitTime(resetTime);

          if (retries < this.maxRetries) {
            this.logger.warn(
              `Rate limited. Waiting ${waitTime}ms before retrying... url=${url}`,
            );
            await this.delay(waitTime);
            retries++;
            continue;
          } else {
            throw new Error("Rate limit exceeded and max retries reached");
          }
        }

        // Handle other errors
        if (!response.ok) {
          throw new Error(
            `GitHub API error on ${url}: ${response.status} ${response.statusText}`,
          );
        }

        // Check if response is empty (204 No Content or empty body)
        const contentLength = response.headers.get("content-length");
        const isEmptyResponse =
          response.status === 204 ||
          (contentLength !== null && parseInt(contentLength) === 0);

        // Handle void return type or empty responses
        if (isEmptyResponse) {
          // For void return types or empty responses, return an empty object or undefined
          return undefined as unknown as T;
        }

        // Parse and return response
        const data = await response.json();
        return data as T;
      } catch (error) {
        if (retries < this.maxRetries && this.shouldRetry(error)) {
          retries++;
          const backoffTime = this.calculateBackoffTime(retries);
          this.logger.warn(
            `Request failed as ${error}. Retrying in ${backoffTime}ms... (${retries}/${this.maxRetries}) method=${method} url=${url}`,
          );
          await this.delay(backoffTime);
          continue;
        }
        this.logger.error(
          `GitHub API request failed method=${method} url=${url}`,
          error as Error,
        );
        throw error;
      }
    }
  }

  /**
   * Build the full URL for an API request
   */
  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith("/")
      ? endpoint.substring(1)
      : endpoint;
    const baseUrl = `${this.baseUrl}/${cleanEndpoint}`;

    // Add query parameters if provided
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(params)) {
        searchParams.append(key, String(value));
      }

      return `${baseUrl}?${searchParams.toString()}`;
    }

    return baseUrl;
  }

  /**
   * Build headers for an API request
   */
  private buildHeaders(
    additionalHeaders: Record<string, string> = {},
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": this.userAgent,
      ...additionalHeaders,
    };

    if (this.token && !additionalHeaders["Authorization"]) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Check if the response indicates rate limiting
   */
  private isRateLimited(headers: ResponseHeaders): boolean {
    const remaining = parseInt(headers.get("x-ratelimit-remaining") || "0", 10);
    return remaining === 0;
  }

  /**
   * Get the rate limit reset time from response headers
   */
  private getRateLimitResetTime(headers: ResponseHeaders): number {
    const resetTimestamp = parseInt(
      headers.get("x-ratelimit-reset") || "0",
      10,
    );
    return resetTimestamp * 1000; // Convert to milliseconds
  }

  /**
   * Calculate wait time before retrying after rate limit
   */
  private calculateWaitTime(resetTime: number): number {
    const now = Date.now();
    const waitTime = resetTime - now;

    // Add a small buffer (1 second) to ensure the rate limit has reset
    return Math.max(waitTime + 1000, 1000);
  }

  /**
   * Determine if we should retry based on the error
   */
  private shouldRetry(error: any): boolean {
    // Retry on network errors, timeouts, or specific API errors
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      // Network error or timeout
      return true;
    }

    if (error.name === "AbortError" || error.name === "TimeoutError") {
      // Request was aborted or timed out
      return true;
    }

    // Could add other specific API errors to retry on
    return false;
  }

  /**
   * Calculate exponential backoff time for retries
   */
  private calculateBackoffTime(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds

    const exponentialDelay = Math.min(
      maxDelay,
      baseDelay * Math.pow(2, retryCount - 1),
    );

    // Add jitter (±20%)
    const jitter = 0.2;
    const jitterAmount = exponentialDelay * jitter;
    const jitterFactor = 1 - jitter + Math.random() * jitter * 2;

    return Math.floor(exponentialDelay * jitterFactor);
  }

  /**
   * Delay execution for a specified time
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convenience method for GET requests
   */
  async get<T>(
    endpoint: string,
    options: Omit<RequestOptions, "method"> = {},
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  /**
   * Convenience method for POST requests
   */
  async post<T>(
    endpoint: string,
    data: any,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data,
    });
  }

  /**
   * Convenience method for PATCH requests
   */
  async patch<T>(
    endpoint: string,
    data: any,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data,
    });
  }

  /**
   * Convenience method for PUT requests
   */
  async put<T>(
    endpoint: string,
    data: any,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body: data });
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete<T>(
    endpoint: string,
    options: Omit<RequestOptions, "method"> = {},
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}
