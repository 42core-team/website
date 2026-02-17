"use client";
import type { Event } from "@/app/actions/event";
import type { MatchStats } from "@/app/actions/stats";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

import Image from "next/image";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GlobalStats from "@/components/GlobalStats";
import { GithubIcon, WikiIcon } from "@/components/icons";
import { CoreLogoWhite } from "@/components/social";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePageClient(props: {
  initialStats: MatchStats;
  currentLiveEvent?: Event;
}) {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const visualizerTheme
    = isMounted && resolvedTheme === "light" ? "light" : "dark";

  const visualizerUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_VISUALIZER_URL;
    const params = new URLSearchParams({
      autoplay: "true",
      speed: "5",
      ui: "false",
      theme: visualizerTheme,
      gridlines: "off",
      themeColor: "000000",
      suppress_version_warning: "true",
    });
    return `${base}/?${params.toString()}`;
  }, [visualizerTheme]);

  const formatTimeLeft = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    const hhmmss = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return days > 0 ? `${days}d ${hhmmss}` : hhmmss;
  };

  const timeLeftMs = props.currentLiveEvent
    ? new Date(props.currentLiveEvent.endDate).getTime() - now.getTime()
    : 0;

  return (
    <div>
      <section className="mb-15 flex flex-col items-center justify-center">
        {/* Foreground (logo + text + links) */}
        <div className="mb-25 flex w-full flex-col justify-center text-center">
          <CoreLogoWhite className="mx-auto h-auto w-[30%]" />
          <h1 className="mx-auto mt-2 block max-w-2xl text-2xl font-bold text-balance">
            Imagine a game contest that brings people
            from around the world together for fun and learning.
          </h1>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button asChild>
              <Link href="/wiki">
                <WikiIcon size={20} />
                Documentation
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                href="https://github.com/42core-team"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon size={20} />
                GitHub
              </Link>
            </Button>
          </div>
          {props.currentLiveEvent && timeLeftMs > 0 && (
            <Card className="mx-auto mt-6 max-w-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-lg font-semibold">
                  {props.currentLiveEvent.name}
                </CardTitle>
                <CardDescription className="space-x-2">
                  <Badge>Live</Badge>
                  <Badge>
                    Ends in
                    {" "}
                    {formatTimeLeft(timeLeftMs)}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href={`/events/${props.currentLiveEvent.id}`}>
                    View event
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Visualizer Embed under the logo */}
        <div className="flex w-full justify-center">
          <div className="mx-auto w-full max-w-6xl px-4">
            <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl">
              {isMounted && (
                <iframe
                  key={visualizerUrl}
                  src={visualizerUrl}
                  className="min-h-full min-w-full"
                  allow="autoplay; fullscreen"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  style={{ pointerEvents: "initial" }}
                  title="CORE Game Replay"
                />
              )}
            </div>
          </div>
        </div>
        <noscript>
          <div className="p-4 text-center">JavaScript is disabled</div>
        </noscript>
      </section>

      {/* Global Stats Section */}
      <GlobalStats initialStats={props.initialStats} />

      <section className="flex min-h-lvh flex-col items-center justify-center gap-16">
        <motion.div
          className="flex flex-col gap-32"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {[
            {
              src: "/images/goblin_archer_idle__0.png",
              alt: "Gib Character",
              content: (
                <div className="flex flex-col items-center gap-4">
                  <h2 className="text-4xl font-bold">What the Game is About</h2>
                  <p className="text-2xl"></p>
                  <p className="text-xl text-muted-foreground">
                    CORE Game is a competitive coding challenge where you design
                    and program your own bots to battle it out in a dynamic 2D
                    arena. Every decision matters—strategy, efficiency, and
                    adaptability will determine whether your bot rises to
                    victory or falls in defeat. Are you ready to code your way
                    to the top?
                  </p>
                </div>
              ),
              delay: 0.2,
              direction: 1,
            },
            {
              src: "/images/goblin_basic_idle__0.png",
              alt: "Bob Character",
              content: (
                <div className="flex flex-col items-center gap-4">
                  <h2 className="text-4xl font-bold">How to Play the Game</h2>
                  <p className="text-2xl"></p>
                  <p className="text-xl text-muted-foreground">{`Write your own bot, fine-tune its strategy, and deploy it into battle. The game runs autonomously based on the logic you've programmed, so your code is your weapon. Learn from past matches, tweak your tactics, and keep improving—because in CORE Game, the smartest code wins.`}</p>
                </div>
              ),
              delay: 0.4,
              direction: -1,
            },
            {
              src: "/images/goblin_tank_idle__0.png",
              alt: "Rob Character",
              content: (
                <div className="flex flex-col items-center gap-4">
                  <h2 className="text-4xl font-bold">
                    What is Necessary to Play
                  </h2>
                  <p className="text-2xl"></p>
                  <p className="text-xl text-muted-foreground">{`All you need is basic programming knowledge, a curious mind, and a hunger for competition! Whether you're a beginner or an experienced coder, you can jump in, experiment, and refine your bot as you go. No fancy hardware required—just bring your creativity and a love for coding!`}</p>
                </div>
              ),
              delay: 0.6,
              direction: 1,
            },
            {
              src: "/images/goblin_healer_idle__0.png",
              alt: "Zob Character",
              content: (
                <div className="flex flex-col items-center gap-4">
                  <h2 className="text-4xl font-bold">
                    What We Offer as a Team
                  </h2>
                  <p className="text-2xl"></p>
                  <p className="text-xl text-muted-foreground">{`We're more than just a game—we're a community of coders, innovators, and problem-solvers. As a team, we provide an engaging platform, regular challenges, and a space to connect with like-minded programmers. Workshops, mentorship, and thrilling competitions—we've got everything you need to grow, learn, and have fun!`}</p>
                </div>
              ),
              delay: 0.8,
              direction: -1,
            },
          ].map(character => (
            <motion.div
              key={character.alt}
              className="relative flex min-h-lvh flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false, margin: "-100px" }}
              transition={{ duration: 1.2 }}
            >
              <div className="absolute left-1/2 z-10 w-[50vw] -translate-x-1/2">
                {character.content}
              </div>
              <motion.div
                initial={{ opacity: 0, x: 0 }}
                whileInView={{
                  opacity: 1,
                  x:
                    character.direction
                    * (typeof window !== "undefined"
                      ? window.innerWidth * 0.47
                      : 600),
                  rotate: character.direction * 15,
                }}
                viewport={{ once: false, margin: "-100px" }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              >
                <Image
                  src={character.src}
                  alt={character.alt}
                  width={800}
                  height={800}
                  className="image-rendering-pixel"
                  style={{
                    imageRendering: "pixelated",
                    transform:
                      character.direction === 1 ? "scaleX(-1)" : "none",
                  }}
                />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
