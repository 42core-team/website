/**
 * Types for the GitHub API client
 */

/**
 * HTTP methods supported by the GitHub API
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Options for making a request to the GitHub API
 */
export interface RequestOptions {
  /**
   * HTTP method to use for the request
   */
  method?: HttpMethod;

  /**
   * Request headers
   */
  headers?: Record<string, string>;

  /**
   * Request body (will be JSON stringified)
   */
  body?: unknown;

  /**
   * Query parameters
   */
  params?: Record<string, string | number | boolean>;
}

/**
 * Response headers from the GitHub API
 * Using the Headers interface from the Fetch API
 */
export type ResponseHeaders = Headers;

/**
 * Error from the GitHub API
 */
export interface GitHubApiError {
  message: string;
  documentation_url?: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
  }>;
}

/**
 * Rate limit information from the GitHub API
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
  resource: string;
}
