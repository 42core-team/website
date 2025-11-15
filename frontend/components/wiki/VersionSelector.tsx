"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, usePathname } from "next/navigation";
import { WikiVersion } from "@/lib/markdown";
import { buildVersionPath } from "@/lib/wiki-navigation";
import { FileText } from "lucide-react";

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

  const currentVersionName =
    versions.find((v) => v.slug === currentVersion)?.name || "Select Version";

  return (
    <>
      {/* Desktop Version - Full Select */}
      <div className="hidden lg:block">
        <Select value={currentVersion} onValueChange={handleVersionChange}>
          <SelectTrigger className="w-32 sm:w-40">
            <SelectValue placeholder="Select version">
              {currentVersionName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {versions.map((version) => (
              <SelectItem key={version.slug} value={version.slug}>
                {version.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile Version - Icon Only */}
      <div className="lg:hidden">
        <Select value={currentVersion} onValueChange={handleVersionChange}>
          <SelectTrigger className="my-2 flex items-center justify-center">
            <FileText className="size-4 mr-1" />
          </SelectTrigger>
          <SelectContent align="end">
            {versions.map((version) => (
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
