import { createFileRoute } from "@tanstack/react-router";
import RushClient from "@/app/RushClient";

export const Route = createFileRoute("/rush")({
  component: RushClient,
});
