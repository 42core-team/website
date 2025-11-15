import { Button } from "@/components/ui/button";
import { GithubIcon } from "./icons";
import { signIn } from "next-auth/react";

export default function GithubLoginButton() {
  async function githubLogin() {
    try {
      await signIn("github");
    } catch (error) {
      console.log("error while logging in:", error);
    }
  }

  return (
    <Button onClick={githubLogin}>
      <GithubIcon />
      Login
    </Button>
  );
}
