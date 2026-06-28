import {
  Navigate,
  Outlet,
  createFileRoute,
  useLocation,
} from "@tanstack/react-router";
import { getDefaultWikiVersion } from "@/lib/markdown";

export const Route = createFileRoute("/wiki")({
  loader: () => getDefaultWikiVersion(),
  component: WikiRoute,
});

function WikiRoute() {
  const defaultVersion = Route.useLoaderData();
  const pathname = useLocation({ select: location => location.pathname });

  if (pathname !== "/wiki" && pathname !== "/wiki/") {
    return <Outlet />;
  }

  return <Navigate to={`/wiki/${defaultVersion}`} replace />;
}
