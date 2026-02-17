"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function Actions() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminView = searchParams.get("adminReveal") === "true";

  return (
    <div className="flex items-center space-x-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 shadow-sm">
      <Switch
        id="admin-view"
        checked={isAdminView}
        onCheckedChange={(value) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("adminReveal", value ? "true" : "false");
          router.replace(`?${params.toString()}`);
        }}
      />
      <Label
        htmlFor="admin-view"
        className="cursor-pointer text-xs font-medium select-none"
      >
        Admin View
      </Label>
    </div>
  );
}
