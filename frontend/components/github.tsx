import { Button } from "@/components/ui/button";
import { GithubIcon } from "./icons";

export default function GithubLoginButton() {
  async function githubLogin() {
    try {
      const base
        = process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL;
      window.location.href = `${base?.replace(/\/$/, "")}/auth/github/callback`;
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
