'use client'

import { PageLayout } from '@/layouts/page-layout'
import Link from '@/components/app-link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

export default function NotFoundClient() {
  return (
    <PageLayout frame="form" centered>
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader className="flex flex-col items-center gap-3">
          <span className="text-sm font-semibold text-link">404</span>
          <h1 className="page-title">Page Not Found</h1>
        </CardHeader>
        <CardContent className="gap-2 text-center">
          <p>Oops! The page you are looking for doesn&apos;t exist.</p>
          <p>
            You can check{' '}
            <Link
              href="https://status.coregame.sh"
              className="text-link hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              status.coregame.sh
            </Link>{' '}
            for any known issues.
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const base =
                'https://github.com/42core-team/website_relaunch/issues/new'
              const title = encodeURIComponent(
                `Bug: 404 on ${location.pathname}`,
              )
              const body = encodeURIComponent(
                `Please help us fix this 404 by filling out the details below.\n\n` +
                  `- Broken URL: ${location.href}\n` +
                  `- Referrer: ${document.referrer || 'N/A'}\n` +
                  `- Expected behavior:\n` +
                  `- Actual behavior (error message or what you saw):\n` +
                  `- Screenshot(s): Drag-and-drop or paste here\n` +
                  `- Browser: ${navigator.userAgent}\n` +
                  `- OS: \n` +
                  `- Device: \n` +
                  `- Time (UTC): ${new Date()
                    .toISOString()
                    .replace('T', ' ')
                    .replace('Z', ' UTC')}\n\n` +
                  `Additional context:\n`,
              )
              window.open(
                `${base}?labels=bug&title=${title}&body=${body}`,
                '_blank',
                'noopener,noreferrer',
              )
            }}
          >
            Open an issue
          </Button>
        </CardFooter>
      </Card>
    </PageLayout>
  )
}
