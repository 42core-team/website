"use client";

import { useRouter, useParams } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export default function BackButton() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id;

  return (
    <Button
      variant="ghost"
      aria-label="Back to teams list"
      onClick={() => {
        router.back();
      }}
    >
      <ArrowLeftIcon size={18} />
    </Button>
  );
}
