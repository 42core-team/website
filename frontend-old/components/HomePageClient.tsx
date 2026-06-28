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
import { Button } from "@/components/ui/button";
import {
  Card,
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
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Link href={`/events/${props.currentLiveEvent.id}`} className="group mx-auto mt-6 block w-full max-w-lg rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:mt-8">
                <Card className="relative h-full w-full overflow-hidden border-white/10 bg-background/60 shadow-2xl backdrop-blur-xl transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:bg-background/80 group-hover:shadow-[0_20px_40px_-15px_rgba(var(--primary),0.3)] group-active:translate-y-0 group-active:scale-[0.98]">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 transition-opacity group-hover:opacity-100" />
                  <CardHeader className="flex flex-row items-center justify-between pb-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute top-0 left-0 inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive"></span>
                        </span>
                        <span className="text-xs font-semibold tracking-widest text-destructive uppercase">
                          Live
                        </span>
                      </div>
                      <CardTitle className="text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary md:text-2xl">
                        {props.currentLiveEvent.name}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-4 border-l border-border/50 pl-4 transition-colors group-hover:border-primary/30">
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase transition-colors group-hover:text-primary/70">Closing in</span>
                        <span className="font-mono text-base font-bold text-foreground tabular-nums transition-colors group-hover:text-primary">
                          {formatTimeLeft(timeLeftMs)}
                        </span>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm transition-all group-hover:scale-105 group-hover:bg-primary/20 group-hover:text-primary">
                        <svg
                          className="h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </motion.div>
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
