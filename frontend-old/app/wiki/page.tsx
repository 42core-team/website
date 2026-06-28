import { redirect } from "next/navigation";
import { getDefaultWikiVersion } from "@/lib/markdown";

/**
 * WikiRoot entry point
 * Instead of doing a runtime redirect on every request,
 * we resolve the default wiki version at build time when possible.
 */
export default async function WikiRoot() {
  const defaultVersion = await getDefaultWikiVersion();

  // Mark this as permanent to avoid unnecessary re-renders
  redirect(`/wiki/${defaultVersion}`);
}

// Pre-generate the root page to immediately resolve default wiki version
export async function generateStaticParams() {
  const defaultVersion = await getDefaultWikiVersion();
  return [
    {
      slug: [defaultVersion],
    },
  ];
}
