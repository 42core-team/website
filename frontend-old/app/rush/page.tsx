import type { Metadata } from "next";
import RushClient from "./RushClient";

export const metadata: Metadata = {
  title: "Rush Subject",
  description: "Secret Rush Subject.",
};

export default function RushPage() {
  return <RushClient />;
}
