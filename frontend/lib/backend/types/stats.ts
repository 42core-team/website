export interface MatchStats {
  actionsExecuted?: string;
  damageDeposits?: string;
  gempilesDestroyed?: string;
  damageTotal?: string;
  gemsGained?: string;
  damageWalls?: string;
  damageCores?: string;
  unitsSpawned?: string;
  tilesTraveled?: string;
  damageSelf?: string;
  damageUnits?: string;
  wallsDestroyed?: string;
  gemsTransferred?: string;
  unitsDestroyed?: string;
  coresDestroyed?: string;
  damageOpponent?: string;
}

export interface QueueMatchesTimeBucket {
  bucket: string;
  count: number;
}
