"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFoundClient() {
  return (
    <div className="flex w-full items-center justify-center p-6 pt-40">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="flex flex-col items-center gap-3">
          <CardTitle className="text-5xl font-bold text-destructive">
            404
          </CardTitle>
          <CardDescription className="text-xl font-medium">
            Page Not Found
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-2 text-center">
          <p>Oops! The page you are looking for doesn't exist.</p>
          <p>
            You can check
            {" "}
            <Link
              href="https://status.coregame.sh"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              status.coregame.sh
            </Link>
            {" "}
            for any known issues.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="destructive"
            onClick={() => {
              const base
                = "https://github.com/42core-team/website_relaunch/issues/new";
              const title = encodeURIComponent(
                `Bug: 404 on ${location.pathname}`,
              );
              const body = encodeURIComponent(
                `Please help us fix this 404 by filling out the details below.\n\n`
                + `- Broken URL: ${location.href}\n`
                + `- Referrer: ${document.referrer || "N/A"}\n`
                + `- Expected behavior:\n`
                + `- Actual behavior (error message or what you saw):\n`
                + `- Screenshot(s): Drag-and-drop or paste here\n`
                + `- Browser: ${navigator.userAgent}\n`
                + `- OS: \n`
                + `- Device: \n`
                + `- Time (UTC): ${new Date()
                  .toISOString()
                  .replace("T", " ")
                  .replace("Z", " UTC")}\n\n`
                  + `Additional context:\n`,
              );
              window.open(
                `${base}?labels=bug&title=${title}&body=${body}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            Open an issue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
