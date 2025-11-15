"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { GithubIcon, WikiIcon } from "@/components/icons";
import { CoreLogoWhite } from "@/components/social";
import GlobalStats from "@/components/GlobalStats";
import { MatchStats } from "@/app/actions/stats";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Event } from "@/app/actions/event";
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

  const visualizerTheme =
    isMounted && resolvedTheme === "light" ? "light" : "dark";

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
      {props.currentLiveEvent && timeLeftMs > 0 && (
        <Card className="absolute right-20 top-20 z-20 md:block hidden">
          <CardHeader className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold">
              {props.currentLiveEvent.name}
            </CardTitle>
            <CardDescription>
              <Badge>Live</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <span className="text-foreground-500"></span>
            <Badge>Ends in {formatTimeLeft(timeLeftMs)}</Badge>
            <div className="mt-1">
              <Button asChild>
                <Link href={`/events/${props.currentLiveEvent.id}`}>
                  View event
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <section className="flex flex-col items-center justify-center mb-15">
        {/* Foreground (logo + text + links) */}
        <div className="relative z-10 inline-block text-center justify-center w-full mb-25">
          <CoreLogoWhite className="mx-auto w-[30%] h-auto" />
          <h1 className="text-2xl font-bold block mt-2">
            Imagine a game contest that brings people
            <br />
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
        </div>

        {/* Visualizer Embed under the logo */}
        <div className="w-full flex justify-center">
          <div className="w-full max-w-6xl px-4 mx-auto">
            <div className="w-full aspect-video overflow-hidden flex items-center justify-center rounded-2xl">
              {isMounted && (
                <iframe
                  key={visualizerUrl}
                  src={visualizerUrl}
                  className="min-w-full min-h-full"
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

      <section className="flex flex-col items-center justify-center gap-16 min-h-lvh">
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
                  <p className="text-xl text-muted-foreground">{`CORE Game is a competitive coding challenge where you design and program your own bots to battle it out in a dynamic 2D arena. Every decision matters—strategy, efficiency, and adaptability will determine whether your bot rises to victory or falls in defeat. Are you ready to code your way to the top?`}</p>
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
          ].map((character) => (
            <motion.div
              key={character.alt}
              className="flex flex-col items-center min-h-lvh justify-center relative"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false, margin: "-100px" }}
              transition={{ duration: 1.2 }}
            >
              <div className="absolute z-10 left-1/2 -translate-x-1/2 w-[50vw]">
                {character.content}
              </div>
              <motion.div
                initial={{ opacity: 0, x: 0 }}
                whileInView={{
                  opacity: 1,
                  x:
                    character.direction *
                    (typeof window !== "undefined"
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
