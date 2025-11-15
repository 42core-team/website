"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getGlobalStats, MatchStats } from "@/app/actions/stats";
import AnimatedNumber from "@/components/animatedNumber";
import { Badge } from "@/components/ui/badge";
import { Gem, Flame, User } from "lucide-react";

export default function GlobalStats(props: { initialStats: MatchStats }) {
  const [stats, setStats] = useState<MatchStats>(props.initialStats);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await getGlobalStats();
      setStats(data);
      setIsLoading(false);
    } catch (error) {
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
      value: parseInt(stats.damageTotal || "0"),
      icon: Flame,
      description: "Total damage dealt across all matches",
      color: "from-red-800 to-red-950",
      iconColor: "text-red-400",
    },
    {
      title: "Gems Gained",
      value: parseInt(stats.gemsGained || "0"),
      icon: Gem,
      description: "Total gems collected in all matches",
      color: "from-blue-800 to-blue-950",
      iconColor: "text-blue-400",
    },
    {
      title: "Units Spawned",
      value: parseInt(stats.unitsSpawned || "0"),
      icon: User,
      description: "Total units created in all matches",
      color: "from-green-800 to-green-950",
      iconColor: "text-green-400",
    },
  ];

  if (isLoading) {
    return (
      <div className="w-full flex justify-center py-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <section>
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8">
          Global Statistics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-linear-to-br ${stat.color} rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-700`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-4xl">
                  <stat.icon className={`w-10 h-10 ${stat.iconColor}`} />
                </span>
                <Badge>Live</Badge>
              </div>

              <h3 className="text-gray-100 text-xl font-semibold mb-2">
                {stat.title}
              </h3>

              <div className="text-4xl font-bold text-primary-500 mb-2">
                <AnimatedNumber value={stat.value} />
              </div>

              <p className="text-gray-200 text-sm">{stat.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
