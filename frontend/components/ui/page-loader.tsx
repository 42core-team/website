import { Spinner } from "@/components/ui/spinner";

export function PageLoader() {
  return (
    <Spinner className="absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2" />
  );
}
