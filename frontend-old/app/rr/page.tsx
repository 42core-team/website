import type { Metadata } from "next";
import RRClient from "./rr-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Never Gonna Give You Up",
  description: "You've been rickrolled!",
};

export default function RickRollPage() {
  return <RRClient />;
}
