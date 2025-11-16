import type { Metadata } from "next/dist/lib/metadata/types/metadata-interface";
import AboutPageClient from "./aboutPage";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn more about CORE Game, our mission, vision, and the team behind it.",
  openGraph: {
    title: "About",
    description:
      "Learn more about CORE Game, our mission, vision, and the team behind it.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "About",
    description:
      "Learn more about CORE Game, our mission, vision, and the team behind it.",
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}
