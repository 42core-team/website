'use client'

import { motion } from 'framer-motion'
import { LucideGithub, LucideLinkedin } from 'lucide-react'
import Image from '@/components/app-image'
import Link from '@/components/app-link'
import { title } from '@/components/primitives'
import { CoreLogoWhite } from '@/components/social'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface TeamMember {
  name: string
  role: string
  imgSrc: string
  linkUrl: string
  linkType: 'linkedin' | 'github'
  former?: boolean
}

const team: TeamMember[] = [
  {
    name: 'Frederick Schubert',
    role: 'Server and Game',
    imgSrc: '/team/fschuber.jpg',
    linkUrl: 'https://www.linkedin.com/in/frederick-m-schubert/',
    linkType: 'linkedin',
  },
  {
    name: 'Paul Großmann',
    role: 'Programs the rest',
    imgSrc: '/team/pgrossma.jpeg',
    linkUrl: 'https://www.linkedin.com/in/pgrossma/',
    linkType: 'linkedin',
  },
  {
    name: 'Theo Paesch',
    role: 'Event Management and Design',
    imgSrc: '/team/tpaesch.jpeg',
    linkUrl: 'https://www.linkedin.com/in/tpaesch/',
    linkType: 'linkedin',
  },
  {
    name: 'Anakin Pregitzer',
    role: 'Head of Rush',
    imgSrc:
      'https://cdn.intra.42.fr/users/f69eb7c83b6b91f6d84d6635cc33e953/medium_apregitz.jpg',
    linkUrl: 'https://www.linkedin.com/in/anakin-pregitzer-927555368/',
    linkType: 'linkedin',
  },
  {
    name: 'Christopher Uhlig',
    role: 'Head of Balancing',
    imgSrc:
      'https://cdn.intra.42.fr/users/c86f2d994f58da1df739af962abca534/medium_chuhlig.jpg',
    linkUrl: 'https://github.com/cuhlig42',
    linkType: 'github',
  },
  {
    name: 'Emil Ebert',
    role: 'Head of Web Systems',
    imgSrc: '/team/eebert.png',
    linkUrl: 'https://www.youtube.com/watch?v=XfELJU1mRMg',
    linkType: 'linkedin',
    former: true,
  },
  {
    name: 'Johannes Moritz',
    role: 'Head of money spending',
    imgSrc:
      'https://cdn.intra.42.fr/users/b70f90a3f5b8abafd72246cad22bda34/medium_jmoritz.jpg',
    linkUrl: 'https://www.linkedin.com/in/johannes-moritz',
    linkType: 'linkedin',
    former: true,
  },
  {
    name: 'Jonas Götz',
    role: 'Head of Server and Kubernetes',
    imgSrc: '/team/jgotz.png',
    linkUrl: 'https://www.linkedin.com/in/jonas-götz-7b66b61bb',
    linkType: 'linkedin',
    former: true,
  },
  {
    name: 'Florian Fischer',
    role: 'Visualizer',
    imgSrc: '/team/flfische.jpg',
    linkUrl: 'https://www.linkedin.com/in/flo-fischer/',
    linkType: 'linkedin',
    former: true,
  },
  {
    name: 'Jonas Kauker',
    role: 'Video',
    imgSrc: '/team/jkauker.jpg',
    linkUrl: 'https://www.linkedin.com/in/jonas-kauker-777894258/',
    linkType: 'linkedin',
    former: true,
  },
  {
    name: 'Konrad Mühlbauer',
    role: 'Website',
    imgSrc:
      'https://cdn.intra.42.fr/users/12e74e15f7b4926f9b9c1e1554b6bcd9/medium_kmuhlbau.jpg',
    linkUrl: 'https://www.linkedin.com/in/konrad-muehlbauer/',
    linkType: 'linkedin',
    former: true,
  },
]

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
            <CoreLogoWhite className="h-auto w-20" />
          </div>
          <p className="mt-4 text-lg text-muted-foreground">
            Bringing the world together through code and creativity
          </p>
        </motion.div>

        <motion.div
          className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 md:grid-cols-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="space-y-4 [&_p]:text-muted-foreground">
            <h2 className="text-2xl font-bold">The Minds Behind CORE Game</h2>
            <p>
              At CORE Game, we're coders, innovators, challengers, and problem
              solvers. What started as a passion project among students at 42
              Heilbronn has evolved into a global coding competition that brings
              together strategy, software design, and game development.
            </p>
            <p>
              Our mission? To create an environment where learning meets
              competition, and where every line of code tells a story. Whether
              you&rsquo;re here to sharpen your programming skills, engage in
              strategic battles with a bot you programmed yourself, or just have
              fun, CORE Game is a playground for creative minds.
            </p>
            <p>
              But CORE Game is more than just a game. It&rsquo;s a community. A
              place where developers from all backgrounds come together to
              compete, collaborate, and grow. From intense coding duels to deep
              strategic planning, every match is an opportunity to learn, adapt,
              and become a better programmer.
            </p>
            <p>
              So, whether you&rsquo;re here to dominate the leaderboard or just
              see what&rsquo;s possible, welcome to CORE Game. Let&rsquo;s
              build, battle, and break boundaries together.
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
              gaming tournaments. Participants write the complete behavior of
              their own bots, submit their code, and watch their strategies play
              out in the arena. Our platform provides match feedback,
              interactive challenges, and a supportive community where
              participants can showcase their skills, learn from others, and
              keep improving their solutions.
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
          <h2 className="mb-12 text-center text-3xl font-bold">
            Meet Our Team
          </h2>
          <div className="grid auto-rows-fr grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {team.map((m, i) => (
              <motion.div
                key={m.name}
                className="w-full"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * (i + 1) }}
              >
                <Card
                  className={cn(
                    'flex h-full flex-col overflow-hidden',
                    m.former &&
                      'border-muted-foreground/20 bg-muted/40 text-muted-foreground shadow-none saturate-0',
                  )}
                >
                  <CardContent className="flex h-full flex-col items-center p-6">
                    <div className="relative mb-4 flex h-40 w-40 shrink-0 items-center justify-center">
                      <div className="h-full w-full overflow-hidden rounded-full bg-muted/20">
                        <Image
                          src={m.imgSrc}
                          alt={`Photo of ${m.name}`}
                          width={200}
                          height={200}
                          className={cn(
                            'h-full w-full object-cover',
                            m.former && 'opacity-70 grayscale',
                          )}
                          style={{ height: '100%' }}
                        />
                      </div>
                      <a
                        href={m.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          'no-icon absolute right-0 bottom-0 rounded-full bg-primary p-2 text-primary-foreground transition-transform hover:scale-110',
                          m.former &&
                            'bg-muted-foreground text-background hover:bg-foreground',
                        )}
                        aria-label={`${m.name} profile link`}
                      >
                        {m.linkType === 'github' ? (
                          <LucideGithub />
                        ) : (
                          <LucideLinkedin />
                        )}
                      </a>
                    </div>
                    <h3 className="text-center text-xl font-semibold">
                      {m.name}
                    </h3>

                    <p className="text-center text-muted-foreground">
                      {m.role}
                    </p>
                    {m.former && (
                      <Badge variant="secondary" className="mt-4">
                        DEPRECATED
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  )
}
