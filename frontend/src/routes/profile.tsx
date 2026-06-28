import { createFileRoute } from "@tanstack/react-router";
import ProfileClient from "@/app/profile/ProfileClient";

export const Route = createFileRoute("/profile")({
  component: ProfileClient,
});
