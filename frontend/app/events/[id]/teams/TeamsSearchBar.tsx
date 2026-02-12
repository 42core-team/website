"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";

export default function TeamsSearchBar({
  initialValue,
}: {
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      router.replace(`${pathname}?${params.toString()}`);
    }, 400); // 400ms debounce

    return () => clearTimeout(handler);
  }, [value]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-500" />
      <Input
        className="w-full pl-10"
        placeholder="Search teams..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
