import { Button } from "@heroui/react";
import { GithubIcon } from "./icons";

export default function GithubLoginButton() {
  function githubLogin() {
    try {
      const base =
        process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL || process.env.BACKEND_URL;
      window.location.href = `${base?.replace(/\/$/, "")}/auth/github/callback`;
    } catch (error) {
      console.log("error while redirecting to login:", error);
    }
  }

  return (
    <Button variant="flat" onPress={githubLogin} startContent={<GithubIcon />}>
      Login
    </Button>
  );
}
