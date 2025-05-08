"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@heroui/react";
import { SearchIcon } from "@/components/icons";
import { useState, useEffect } from "react";

export default function TeamsSearchBar({
  initialValue,
  sortColumn,
  sortDirection,
}: {
  initialValue: string;
  sortColumn: string;
  sortDirection: string;
}) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      params.set("sort", sortColumn);
      params.set("dir", sortDirection);
      router.replace(`?${params.toString()}`);
    }, 400); // 400ms debounce

    return () => clearTimeout(handler);
  }, [value, sortColumn, sortDirection]);

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
