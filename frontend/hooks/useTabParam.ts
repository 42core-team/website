import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useTabParam(defaultTab: string = "graph") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTab = searchParams.get("tab") || defaultTab;

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return { currentTab, onTabChange };
}
