'use client'

import { PageHeader, PageLayout } from '@/layouts/page-layout'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DownloadIcon } from '@/components/icons'

export default function RushClient() {
  const [mounted, setMounted] = useState(false)
  const pdfUrl =
    'https://core-files.object.storage.eu01.onstackit.cloud/subjects/rush/rush-02.pdf'

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <PageLayout>
      <PageHeader
        title="Rush Subject"
        actions={
          <Button asChild>
            <a href={pdfUrl} download="rush-02.pdf">
              <DownloadIcon aria-hidden="true" />
              Download PDF
            </a>
          </Button>
        }
      />

      {mounted && (
        <div className="h-[75dvh] w-full overflow-hidden rounded-xl border bg-black">
          <iframe
            src={pdfUrl}
            className="h-full w-full"
            title="CORE Rush Guide"
          />
        </div>
      )}
    </PageLayout>
  )
}
