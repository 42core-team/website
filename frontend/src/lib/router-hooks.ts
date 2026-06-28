import {
  useLocation,
  useNavigate,
  useParams as useTanStackParams,
} from "@tanstack/react-router";
import React from "react";

export function usePathname() {
  return useLocation({ select: location => location.pathname });
}

export function useSearchParams() {
  const searchStr = useLocation({ select: location => location.searchStr });
  return React.useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

export function useParams<TParams extends Record<string, string> = Record<string, string>>() {
  return useTanStackParams({ strict: false }) as TParams;
}

export function useRouter() {
  const navigate = useNavigate();

  return {
    push: (href: string) => navigate({ to: href }),
    replace: (href: string) => navigate({ to: href, replace: true }),
    back: () => window.history.back(),
    refresh: () => window.location.reload(),
  };
}
