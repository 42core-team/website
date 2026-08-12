import { RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

/**
 * Reject browser cross-site mutations that carry the authentication cookie.
 * Requests without cookie authentication remain available to non-browser
 * clients and are still subject to the normal authentication guards.
 */
export function createCsrfProtection(
  allowedOrigin: string,
  authCookieName: string,
): RequestHandler {
  const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);
  if (!normalizedAllowedOrigin) {
    throw new Error(`Invalid CORS_ORIGIN: ${allowedOrigin}`);
  }

  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) return next();

    const cookies = (
      req as typeof req & {
        cookies?: Record<string, string>;
      }
    ).cookies;
    if (!cookies?.[authCookieName]) return next();

    const origin = req.get("origin");
    const fetchSite = req.get("sec-fetch-site")?.toLowerCase();
    const hasTrustedOrigin =
      origin !== undefined &&
      normalizeOrigin(origin) === normalizedAllowedOrigin;
    const hasTrustedFetchSite =
      fetchSite === "same-origin" || fetchSite === "same-site";
    const hasTrustedBrowserContext = origin
      ? hasTrustedOrigin
      : hasTrustedFetchSite;

    if (!hasTrustedBrowserContext) {
      return res.status(403).json({
        statusCode: 403,
        message: "Cross-site authenticated requests are forbidden",
        error: "Forbidden",
      });
    }

    return next();
  };
}
