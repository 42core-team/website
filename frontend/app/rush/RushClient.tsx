"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { title } from "@/components/primitives";

export default function RushClient() {
  const [mounted, setMounted] = useState(false);
  const pdfUrl
    = "https://core-files.object.storage.eu01.onstackit.cloud/subjects/rush/rush-02.pdf";

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="container mx-auto px-4 py-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center"
      >
        <div className="flex flex-row items-center justify-center gap-4">
          <h1 className={title()}>Rush Subject</h1>
          <motion.a
            href={pdfUrl}
            download="rush-02.pdf"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.8 }}
            className="flex items-center gap-2 rounded-full bg-primary p-2 text-white shadow-lg transition-colors hover:bg-primary/80"
            aria-label="Download PDF"
          >
            <DownloadIcon className="h-5 w-5" />
          </motion.a>
        </div>
      </motion.div>

      {mounted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full overflow-hidden rounded-lg bg-black shadow-xl"
          style={{ height: "75vh" }}
        >
          <iframe
            src={pdfUrl}
            className="h-full w-full"
            title="CORE Rush Guide"
          />
        </motion.div>
      )}
    </div>
  );
}
