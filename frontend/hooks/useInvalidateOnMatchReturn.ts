"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const INVALIDATE_ON_MATCH_RETURN_KEY = "invalidate-on-match-return";

export function markMatchReturnInvalidate(pathname: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(INVALIDATE_ON_MATCH_RETURN_KEY, pathname);
}

export function useInvalidateOnMatchReturn(
  queryKeys: readonly (readonly unknown[])[],
) {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const invalidatePath = window.sessionStorage.getItem(
      INVALIDATE_ON_MATCH_RETURN_KEY,
    );

    if (invalidatePath !== pathname) {
      return;
    }

    window.sessionStorage.removeItem(INVALIDATE_ON_MATCH_RETURN_KEY);
    queryKeys.forEach((queryKey) => {
      void queryClient.invalidateQueries({ queryKey });
    });
  }, [pathname, queryClient, queryKeys]);
}
