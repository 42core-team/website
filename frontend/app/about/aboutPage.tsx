"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { title } from "@/components/primitives";
import { CoreLogoWhite } from "@/components/social";
import Link from "next/link";
import { LucideGithub, LucideLinkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type TeamMember = {
  name: string;
  role: string;
  imgSrc: string;
  linkUrl: string;
  linkType: "linkedin" | "github";
};

const team: TeamMember[] = [
  {
    name: "Frederick Schubert",
    role: "Server and Game",
    imgSrc: "/team/fschuber.jpg",
    linkUrl: "https://www.linkedin.com/in/frederick-m-schubert/",
    linkType: "linkedin",
  },
  {
    name: "Paul Großmann",
    role: "Programs the rest",
    imgSrc: "/team/pgrossma.jpeg",
    linkUrl: "https://www.linkedin.com/in/pgrossma/",
    linkType: "linkedin",
  },
  {
    name: "Emil Ebert",
    role: "Website",
    imgSrc: "/team/eebert.png",
    linkUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    linkType: "linkedin",
  },
  {
    name: "Theo Paesch",
    role: "Event Management and Design",
    imgSrc: "/team/tpaesch.jpeg",
    linkUrl: "https://www.linkedin.com/in/tpaesch/",
    linkType: "linkedin",
  },
  {
    name: "Johannes Moritz",
    role: "Head of money spending",
    imgSrc:
      "https://cdn.intra.42.fr/users/b70f90a3f5b8abafd72246cad22bda34/medium_jmoritz.jpg",
    linkUrl: "https://www.linkedin.com/in/johannes-moritz",
    linkType: "linkedin",
  },
  {
    name: "Jonas Götz",
    role: "Head of Server and Kubernetes",
    imgSrc: "/team/jgotz.png",
    linkUrl: "https://www.linkedin.com/in/jonas-götz-7b66b61bb",
    linkType: "linkedin",
  },
  {
    name: "Florian Fischer",
    role: "Visualizer",
    imgSrc: "/team/flfische.jpg",
    linkUrl: "https://www.linkedin.com/in/flo-fischer/",
    linkType: "linkedin",
  },
  {
    name: "Jonas Kauker",
    role: "Video",
    imgSrc: "/team/jkauker.jpg",
    linkUrl: "https://www.linkedin.com/in/jonas-kauker-777894258/",
    linkType: "linkedin",
  },
  {
    name: "Anakin Pregitzer",
    role: "Head of Rush",
    imgSrc:
      "https://cdn.intra.42.fr/users/f69eb7c83b6b91f6d84d6635cc33e953/medium_apregitz.jpg",
    linkUrl: "https://www.linkedin.com/in/anakin-pregitzer-927555368/",
    linkType: "linkedin",
  },
  {
    name: "Christopher Uhlig",
    role: "Head of Balancing",
    imgSrc:
      "https://cdn.intra.42.fr/users/c86f2d994f58da1df739af962abca534/medium_chuhlig.jpg",
    linkUrl: "https://github.com/cuhlig42",
    linkType: "github",
  },
  {
    name: "Konrad Mühlbauer",
    role: "Website",
    imgSrc:
      "https://cdn.intra.42.fr/users/12e74e15f7b4926f9b9c1e1554b6bcd9/medium_kmuhlbau.jpg",
    linkUrl: "https://www.linkedin.com/in/konrad-muehlbauer/",
    linkType: "linkedin",
  },
];

export default function AboutPageClient() {
  return (
    <div>
      <section className="flex flex-col items-center justify-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="flex flex-row items-center justify-center gap-4">
            <h1 className={title()}>About</h1>
            <CoreLogoWhite className="w-20 h-auto" />
          </div>
          <p className="mt-4 text-lg text-muted-foreground">
            Bringing the world together through code and creativity
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto px-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="space-y-4 [&_p]:text-muted-foreground">
            <h2 className="text-2xl font-bold">The Minds Behind CORE Game</h2>
            <p>
              At CORE Game, we&rsquo;re more than just coders&mdash;we&rsquo;re
              innovators, challengers, and problem-solvers. What started as a
              passion project among students at 42 Heilbronn has evolved into a
              global coding competition that pushes the limits of strategy, AI,
              and game development.
            </p>
            <p>
              Our mission? To create an environment where learning meets
              competition, and where every line of code tells a story. Whether
              you&rsquo;re here to sharpen your programming skills, engage in
              high-level AI battles, or just have fun, CORE Game is the ultimate
              playground for creative minds.
            </p>
            <p>
              But CORE Game is more than just a game&mdash;it&rsquo;s a
              community. A place where developers from all backgrounds come
              together to compete, collaborate, and grow. From intense coding
              duels to deep strategic planning, every match is an opportunity to
              learn, adapt, and become a better programmer.
            </p>
            <p>
              So, whether you&rsquo;re here to dominate the leaderboard or just
              see what&rsquo;s possible, welcome to CORE Game. Let&rsquo;s
              build, battle, and break boundaries&mdash;together.
            </p>
          </div>

          <div className="space-y-4 [&_p]:text-muted-foreground">
            <h2 className="text-2xl font-bold">Our Vision</h2>
            <p>
              We envision a world where coding is accessible, engaging, and fun
              for everyone. By combining gaming elements with programming
              challenges, we&rsquo;re building bridges between entertainment and
              education, creating unique opportunities for learning and
              collaboration.
            </p>
          </div>

          <div className="space-y-4 [&_p]:text-muted-foreground">
            <h2 className="text-2xl font-bold">What We Do</h2>
            <p>
              We organize international coding competitions that feel like
              gaming tournaments. Our platform provides real-time feedback,
              interactive challenges, and a supportive community where
              participants can showcase their skills, learn from others, and
              push their boundaries.
            </p>
          </div>

          <div className="space-y-4 [&_p]:text-muted-foreground">
            <h2 className="text-2xl font-bold">Join Our Community</h2>
            <p>
              Whether you&rsquo;re a beginner taking your first steps in coding
              or an experienced developer looking for new challenges, CORE
              welcomes you. Join our growing community and be part of the next
              generation of programming excellence.
            </p>
          </div>
        </motion.div>

        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <p className="text-xl">Ready to start your journey with CORE?</p>
          <div className="mt-4">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/wiki">Get Started Today</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="py-16">
        <motion.div
          className="container mx-auto px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-center mb-12">
            Meet Our Team
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((m, i) => (
              <motion.div
                key={m.name}
                className="w-full max-w-sm mx-auto"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * (i + 1) }}
              >
                <Card>
                  <CardContent className="p-6 flex flex-col items-center">
                    <div className="relative">
                      <Image
                        src={m.imgSrc}
                        alt={`Photo of ${m.name}`}
                        width={200}
                        height={200}
                        className="w-40 h-40 rounded-full object-cover mb-4"
                      />
                      <a
                        href={m.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2.5 right-2.5 bg-primary text-primary-foreground rounded-full p-2 hover:scale-110 transition-transform"
                        aria-label={`${m.name} profile link`}
                      >
                        {m.linkType === "github" ? (
                          <LucideGithub />
                        ) : (
                          <LucideLinkedin />
                        )}
                      </a>
                    </div>
                    <h3 className="text-xl font-semibold text-center">
                      {m.name}
                    </h3>

                    <p className="text-muted-foreground text-center">
                      {m.role}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
