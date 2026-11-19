'use client'

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
    <main className="page-frame py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Rush Subject</h1>
        <Button asChild>
          <a href={pdfUrl} download="rush-02.pdf">
            <DownloadIcon aria-hidden="true" />
            Download PDF
          </a>
        </Button>
      </header>

      {mounted && (
        <div className="h-[75vh] w-full overflow-hidden rounded-xl border bg-black">
          <iframe
            src={pdfUrl}
            className="h-full w-full"
            title="CORE Rush Guide"
          />
        </div>
      )}
    </main>
  )
}
