"use client";

import type { MatchStats } from "@/app/actions/stats";
import { motion } from "framer-motion";
import { Flame, Gem, User } from "lucide-react";
import { useEffect, useState } from "react";
import { getGlobalStats } from "@/app/actions/stats";
import AnimatedNumber from "@/components/animatedNumber";
import { Badge } from "@/components/ui/badge";

export default function GlobalStats(props: { initialStats: MatchStats }) {
  const [stats, setStats] = useState<MatchStats>(props.initialStats);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await getGlobalStats();
      setStats(data);
      setIsLoading(false);
    }
    catch (error) {
      console.error("Error fetching global stats:", error);
    }
  };

  useEffect(() => {
    fetchStats();

    const intervalId = setInterval(fetchStats, 2000);

    return () => clearInterval(intervalId);
  }, []);

  const statCards = [
    {
      title: "Total Damage",
      value: Number.parseInt(stats.damageTotal || "0"),
      icon: Flame,
      description: "Total damage dealt across all matches",
      color: "from-red-800 to-red-950",
      iconColor: "text-red-400",
    },
    {
      title: "Gems Gained",
      value: Number.parseInt(stats.gemsGained || "0"),
      icon: Gem,
      description: "Total gems collected in all matches",
      color: "from-blue-800 to-blue-950",
      iconColor: "text-blue-400",
    },
    {
      title: "Units Spawned",
      value: Number.parseInt(stats.unitsSpawned || "0"),
      icon: User,
      description: "Total units created in all matches",
      color: "from-green-800 to-green-950",
      iconColor: "text-green-400",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex w-full justify-center py-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <section>
      <div className="container mx-auto px-4">
        <h2 className="mb-8 text-center text-3xl font-bold">
          Global Statistics
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {statCards.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-linear-to-br ${stat.color} rounded-xl border border-gray-700 p-6 shadow-lg transition-all duration-300 hover:shadow-2xl`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-4xl">
                  <stat.icon className={`h-10 w-10 ${stat.iconColor}`} />
                </span>
                <Badge>Live</Badge>
              </div>

              <h3 className="mb-2 text-xl font-semibold text-gray-100">
                {stat.title}
              </h3>

              <div className="text-primary-500 mb-2 text-4xl font-bold">
                <AnimatedNumber value={stat.value} />
              </div>

              <p className="text-sm text-gray-200">{stat.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
