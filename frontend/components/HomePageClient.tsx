"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";

import { button as buttonStyles } from "@heroui/theme";

import { GithubIcon, WikiIcon } from "@/components/icons";
import { CoreLogoWhite } from "@/components/social";
import GlobalStats from "@/components/GlobalStats";

export default function HomePageClient() {
  return (
    <div>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block text-center justify-center w-full">
          <CoreLogoWhite className="mx-auto w-[30%] h-auto" />
          <span className="text-2xl font-bold">
            Imagine a game contest that brings people
            <br />
            from around the world together for fun and learning.
          </span>
        </div>

        <div className="flex gap-3">
          <Link
            className={buttonStyles({
              color: "primary",
              radius: "full",
              variant: "shadow",
            })}
            href="/wiki"
          >
            <WikiIcon size={20} />
            Documentation
          </Link>
          <Link
            className={buttonStyles({ variant: "bordered", radius: "full" })}
            href="https://github.com/42core-team/my-core-bot"
          >
            <GithubIcon size={20} />
            GitHub
          </Link>
        </div>
      </section>

      {/* Global Stats Section */}
      <GlobalStats />

      <section className="flex flex-col items-center justify-center gap-32 py-12 min-h-lvh">
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
                  <h1 className="text-4xl font-bold">What the Game is About</h1>
                  <p className="text-2xl"></p>
                  <p className="text-xl text-gray-400">{`CORE Game is a competitive coding challenge where you design and program your own AI-powered bots to battle it out in a dynamic 2D arena. Every decision matters—strategy, efficiency, and adaptability will determine whether your bot rises to victory or falls in defeat. Are you ready to code your way to the top?`}</p>
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
                  <h1 className="text-4xl font-bold">How to Play the Game</h1>
                  <p className="text-2xl"></p>
                  <p className="text-xl text-gray-400">{`Write your own bot, fine-tune its strategy, and deploy it into battle. The game runs autonomously based on the logic you've programmed, so your code is your weapon. Learn from past matches, tweak your tactics, and keep improving—because in CORE Game, the smartest code wins.`}</p>
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
                  <h1 className="text-4xl font-bold">
                    What is Necessary to Play
                  </h1>
                  <p className="text-2xl"></p>
                  <p className="text-xl text-gray-400">{`All you need is basic programming knowledge, a curious mind, and a hunger for competition! Whether you&apos;re a beginner or an experienced coder, you can jump in, experiment, and refine your bot as you go. No fancy hardware required—just bring your creativity and a love for coding!`}</p>
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
                  <h1 className="text-4xl font-bold">
                    What We Offer as a Team
                  </h1>
                  <p className="text-2xl"></p>
                  <p className="text-xl text-gray-400">{`We're more than just a game—we're a community of coders, innovators, and problem-solvers. As a team, we provide an engaging platform, regular challenges, and a space to connect with like-minded programmers. Workshops, mentorship, and thrilling competitions—we've got everything you need to grow, learn, and have fun!`}</p>
                </div>
              ),
              delay: 0.8,
              direction: -1,
            },
          ].map((character, index) => (
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
