import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "./icons";

export default function GithubLoginButton() {
  async function githubLogin() {
    try {
      await signIn("github");
    }
    catch (error) {
      console.error("error while logging in:", error);
    }
  }

  return (
    <Button onClick={githubLogin}>
      <GithubIcon />
      Login
    </Button>
  );
}
