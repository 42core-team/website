"use client";

import { Select, SelectItem } from "@heroui/react";
import { useRouter, usePathname } from "next/navigation";
import { WikiVersion } from "@/lib/markdown";
import { buildVersionPath } from "@/lib/wiki-navigation";

interface VersionSelectorProps {
  versions: WikiVersion[];
  currentVersion: string;
}

export function VersionSelector({
  versions,
  currentVersion,
}: VersionSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleVersionChange = (version: string) => {
    const newPath = buildVersionPath(pathname, version, versions);
    router.push(newPath);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-default-600 hidden sm:inline">
        Version:
      </span>
      <Select
        size="sm"
        selectedKeys={[currentVersion]}
        onSelectionChange={(keys) => {
          const selectedVersion = Array.from(keys)[0] as string;
          if (selectedVersion && selectedVersion !== currentVersion) {
            handleVersionChange(selectedVersion);
          }
        }}
        className="w-32 sm:w-40"
        aria-label="Select version"
      >
        {versions.map((version) => (
          <SelectItem key={version.slug}>{version.name}</SelectItem>
        ))}
      </Select>
    </div>
  );
}
