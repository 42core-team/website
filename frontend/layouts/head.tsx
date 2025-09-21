import React from "react";
import NextHead from "next/head";

import { siteConfig } from "@/config/site";

export const Head = () => {
  let visualizerOrigin: string | undefined;
  try {
    const v = process.env.NEXT_PUBLIC_VISUALIZER_URL;
    if (v) {
      const url = new URL(v);
      visualizerOrigin = url.origin;
    }
  } catch {
    // ignore invalid URL
  }

  return (
    <NextHead>
      <title>{siteConfig.name}</title>
      <meta key="title" content={siteConfig.name} property="og:title" />
      <meta content={siteConfig.description} property="og:description" />
      <meta content={siteConfig.description} name="description" />
      <meta
        key="viewport"
        content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"
        name="viewport"
      />
      <link href="/favicon.ico" rel="icon" />
      {visualizerOrigin && (
        <>
          <link rel="dns-prefetch" href={visualizerOrigin} />
          <link
            rel="preconnect"
            href={visualizerOrigin}
            crossOrigin="anonymous"
          />
        </>
      )}
    </NextHead>
  );
};
