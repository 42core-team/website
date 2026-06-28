"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SsoPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const getRedirectPath = () => {
      if (typeof window === "undefined")
        return "/";
      const stored = sessionStorage.getItem("post_oauth_redirect") || "/";
      sessionStorage.removeItem("post_oauth_redirect");
      return stored.startsWith("/") ? stored : "/";
    };
    (async () => {
      try {
        await signIn("backend", { redirect: false });
        if (!cancelled) {
          router.replace(getRedirectPath());
          router.refresh();
        }
      }
      catch (e) {
        console.error("Failed to finalize SSO:", e);
        if (!cancelled)
          router.replace("/auth/error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);
  return (
    <div className="flex min-h-lvh items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        <p className="text-default-600 mt-4">Finishing sign-in...</p>
      </div>
    </div>
  );
}
