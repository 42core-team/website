"use client";

import type { WikiVersion } from "@/lib/wiki/types";
import { FileText } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildVersionPath } from "@/lib/wiki/shared-paths";

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

  const currentVersionName
    = versions.find(v => v.slug === currentVersion)?.name || "Select Version";

  return (
    <>
      <div className="hidden lg:block">
        <Select value={currentVersion} onValueChange={handleVersionChange}>
          <SelectTrigger className="h-11 min-w-[9rem] border-border/80 bg-background/80 pr-3 pl-4 shadow-sm">
            <SelectValue placeholder="Select version">
              {currentVersionName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {versions.map(version => (
              <SelectItem key={version.slug} value={version.slug}>
                {version.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="lg:hidden">
        <Select value={currentVersion} onValueChange={handleVersionChange}>
          <SelectTrigger className="size-11 border-border/80 bg-background/80 px-0 shadow-sm">
            <FileText className="size-4" />
          </SelectTrigger>
          <SelectContent align="end">
            {versions.map(version => (
              <SelectItem key={version.slug} value={version.slug}>
                {version.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
