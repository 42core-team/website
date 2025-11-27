"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SsoPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await signIn("backend", { redirect: false });
        if (!cancelled) {
          router.replace("/");
          router.refresh();
        }
      } catch (e) {
        console.error("Failed to finalize SSO:", e);
        if (!cancelled) router.replace("/auth/error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);
  return (
    <div className="flex justify-center items-center min-h-lvh">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-default-600">Finishing sign-in...</p>
      </div>
    </div>
  );
}
