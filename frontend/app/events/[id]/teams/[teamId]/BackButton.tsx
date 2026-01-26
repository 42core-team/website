"use client";

import { ArrowLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export default function BackButton() {
  return (
    <Button
      variant="ghost"
      aria-label="Back to teams list"
      onClick={() => {
        window.history.back();
      }}
    >
      <ArrowLeftIcon size={18} />
    </Button>
  );
}
