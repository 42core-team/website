import { redirect } from "next/navigation";
import { getDefaultWikiVersion } from "@/lib/wiki";

/**
 * WikiRoot entry point
 * Instead of doing a runtime redirect on every request,
 * we resolve the default wiki version at build time when possible.
 */
export default async function WikiRoot() {
  const defaultVersion = await getDefaultWikiVersion();
  redirect(`/wiki/${defaultVersion}`);
}
