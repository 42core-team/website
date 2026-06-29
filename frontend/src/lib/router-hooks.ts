import {
  useLocation,
  useNavigate,
  useParams as useTanStackParams,
} from "@tanstack/react-router";
import type { RegisteredRouter } from "@tanstack/react-router";
import type { AllParams } from "@tanstack/router-core";
import React from "react";

type AppRouteParams = AllParams<RegisteredRouter["routeTree"]>;

export function usePathname() {
  return useLocation({ select: location => location.pathname });
}

export function useSearchParams() {
  const searchStr = useLocation({ select: location => location.searchStr });
  return React.useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

export function useParams(): AppRouteParams {
  return useTanStackParams<
    RegisteredRouter,
    undefined,
    false,
    true,
    unknown,
    false
  >({
    strict: false,
    structuralSharing: false,
  });
}

export function useRouter() {
  const navigate = useNavigate();

  return {
    push: (href: string) => navigate({ href }),
    replace: (href: string) => navigate({ href, replace: true }),
    back: () => window.history.back(),
    refresh: () => window.location.reload(),
  };
}
