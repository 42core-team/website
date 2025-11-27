"use client";

import { useEffect, useState } from "react";

export default function RepoLockCountdown(props: { repoLockDate: string }) {
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    function calculateTimeLeft() {
      const lockDate = new Date(props.repoLockDate);
      const now = new Date();
      const timeDiff = lockDate.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setCountdown("Repo lock has passed");
        if (interval) clearInterval(interval);
        return;
      }

      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }

    interval = setInterval(calculateTimeLeft, 1000);
    calculateTimeLeft();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [props.repoLockDate]);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500">Repo Lock Countdown</h3>
      <p className="mt-1 text-sm text text-red-400">{countdown}</p>
    </div>
  );
}
