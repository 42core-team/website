import React from "react";
import type { Metadata } from "next";

import "@/styles/globals.css";
import DefaultLayout from "@/layouts/default";
import ClientProviders from "@/components/ClientProviders";
import PlausibleProvider from "next-plausible";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "https://coregame.de"),
  title: {
    default: "CORE Game",
    template: "%s | CORE Game",
  },
  description:
    "Official homepage of CORE Game, the strategic programming competition where you develop bots to outsmart opponents.",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "programming competition",
    "bot programming",
    "42 school",
    "strategy game",
    "coding challenge",
    "coding game",
  ],
  openGraph: {
    title: "CORE Game — Bot Programming Competition",
    description:
      "Design bots, battle in a 2D arena, and climb the leaderboard in the CORE Game coding competition.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/CORE-LOGO.svg",
        alt: "CORE Game logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CORE Game — Bot Programming Competition",
    description:
      "Design bots, battle in a 2D arena, and climb the leaderboard in the CORE Game coding competition.",
    images: ["/CORE-LOGO.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  category: "coding game",
};

export default function App({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PlausibleProvider
          domain={process.env.PLAUSIBLE_DOMAIN ?? "coregame.de"}
          customDomain={process.env.PLAUSIBLE_CUSTOM_DOMAIN}
          selfHosted={true}
          trackOutboundLinks={true}
          trackFileDownloads={true}
          taggedEvents={true}
        >
          <ClientProviders>
            <DefaultLayout>{children}</DefaultLayout>
          </ClientProviders>
        </PlausibleProvider>
      </body>
    </html>
  );
}
