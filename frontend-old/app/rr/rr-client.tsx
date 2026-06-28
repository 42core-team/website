"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RRClient() {
  const router = useRouter();

  useEffect(() => {
    const shouldRedirectToVideo = Math.random() < 0.5;
    const redirectUrl = shouldRedirectToVideo
      ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      : "/";
    router.push(redirectUrl);
  }, [router]);

  return null;
}
