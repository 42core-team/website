"use client";
import { Link } from "@heroui/link";
import { siteConfig } from "@/config/site";

export default function Footer() {
  const handleReportIssue = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const repo = "42core-team/website_relaunch";
    const base = `https://github.com/${repo}/issues/new`;
    const title = encodeURIComponent(
      `Feedback: ${document.title || "Website issue/idea"}`,
    );
    const ua = navigator.userAgent;
    const body = encodeURIComponent(
      `Please describe the issue or suggestion:\n\n- Page URL: ${location.href}\n- Referrer: ${
        document.referrer || "N/A"
      }\n- What were you trying to do?\n- Steps to reproduce:\n- Expected result:\n- Actual result:\n- Screenshot(s): Drag-and-drop or paste here\n- Browser: ${ua}\n- OS:\n- Device:\n- Time (UTC): ${new Date()
        .toISOString()
        .replace("T", " ")
        .replace(
          "Z",
          " UTC",
        )}\n\nAdditional context:\n\nType of report: [ ] Bug [ ] Content issue [ ] Design [ ] Performance [ ] Accessibility`,
    );
    location.href = `${base}?labels=feedback&title=${title}&body=${body}`;
  };
  return (
    <footer className="w-full border-t border-default-200">
      <div className="container mx-auto max-w-7xl py-12 px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo-white.svg" alt="CORE" className="w-8 h-8" />
              <span className="font-bold text-xl">CORE</span>
            </Link>
            <p className="mt-4 text-default-500">
              CORE Game is a competitive coding challenge where you design and
              program your own bots to battle it out in a dynamic 2D arena.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold mb-4">Quick Links</h3>
            <div className="flex flex-col gap-2">
              <Link href="/" className="text-default-500 hover:text-primary">
                Home
              </Link>
              <Link
                href="/events"
                className="text-default-500 hover:text-primary"
              >
                Events
              </Link>
              <Link
                href="/wiki"
                className="text-default-500 hover:text-primary"
              >
                Wiki
              </Link>
              <Link
                href="/changelog"
                className="text-default-500 hover:text-primary"
              >
                Changelog
              </Link>
              <Link
                href="/about"
                className="text-default-500 hover:text-primary"
              >
                About Us
              </Link>
            </div>
          </div>

          {/* Social Links */}
          <div>
            <h3 className="font-bold mb-4">Connect</h3>
            <div className="flex flex-col gap-2">
              <Link
                href="https://status.coregame.de"
                target="_blank"
                rel="noopener noreferrer"
                className="text-default-500 hover:text-primary"
              >
                Status Page
              </Link>
              <Link
                href={siteConfig.links.github}
                isExternal
                className="text-default-500 hover:text-primary"
              >
                GitHub
              </Link>
              <a
                href="#"
                onClick={handleReportIssue}
                className="text-default-500 hover:text-primary"
              >
                Report an issue
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 pt-8 border-t border-default-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-default-500 text-sm">
              © 2025 CORE Game. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm">
              <Link
                href="/impressum"
                className="text-default-500 hover:text-primary"
              >
                Impressum
              </Link>
              <Link
                href="/datenschutz"
                className="text-default-500 hover:text-primary"
              >
                Datenschutz
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
