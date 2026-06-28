import type { Metadata } from "next";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = {
  title: "Profile",
  description:
    "Manage your CORE Game account and your linked social platforms.",
  openGraph: {
    title: "Profile",
    description:
      "Manage your CORE Game account and your linked social platforms.",
    type: "profile",
  },
  twitter: {
    card: "summary",
    title: "Profile",
    description:
      "Manage your CORE Game account and your linked social platforms.",
  },
};

export default function ProfilePage() {
  return <ProfileClient />;
}
