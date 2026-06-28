import type { Metadata } from "next";
import NotFoundClient from "@/components/system/NotFoundClient";

export const metadata: Metadata = {
  title: "404 - Page Not Found",
  description: "The page you requested could not be found on CORE Game.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "404 - Page Not Found",
    description: "The page you requested could not be found on CORE Game.",
  },
  twitter: {
    card: "summary",
    title: "404 - Page Not Found",
    description: "The page you requested could not be found on CORE Game.",
  },
};

export default function NotFound() {
  return <NotFoundClient />;
}
