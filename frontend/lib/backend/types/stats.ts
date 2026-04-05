export interface MatchStats {
  actionsExecuted?: number;
  damageDeposits?: number;
  gempilesDestroyed?: number;
  damageTotal?: number;
  gemsGained?: number;
  damageWalls?: number;
  damageCores?: number;
  unitsSpawned?: number;
  tilesTraveled?: number;
  damageSelf?: number;
  damageUnits?: number;
  wallsDestroyed?: number;
  gemsTransferred?: number;
  unitsDestroyed?: number;
  coresDestroyed?: number;
  damageOpponent?: number;
}

export interface QueueMatchesTimeBucket {
  bucket: string;
  count: number;
}
