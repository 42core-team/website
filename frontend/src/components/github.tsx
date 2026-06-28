import { Button } from "@/components/ui/button";
import { getBackendBaseUrl } from "@/lib/env";
import { GithubIcon } from "./icons";

export default function GithubLoginButton() {
  async function githubLogin() {
    try {
      if (typeof window !== "undefined") {
        const { pathname, search, hash } = window.location;
        sessionStorage.setItem(
          "post_oauth_redirect",
          `${pathname}${search}${hash}`,
        );
      }
      window.location.href = `${getBackendBaseUrl()}/auth/github/callback`;
    }
    catch (error) {
      console.error("error while redirecting to login:", error);
    }
  }

  return (
    <Button onClick={githubLogin}>
      <GithubIcon />
      Login
    </Button>
  );
}
