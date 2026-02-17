# Tournament Logic Documentation

This document describes the scoring, advancement, and seeding logic used in the tournament system.

## 1. Swiss Phase (Group Phase)

The Swiss Phase is the initial part of the event where teams play a fixed number of rounds against opponents with similar records.

### Scoring and Ranking

- **Primary Score (`score`):** Teams receive **1 point** for each match win.
- **Secondary Score (Buchholz Points):** Used as a tie-breaker. A team's Buchholz points are calculated as the **sum of the current scores of all opponents that the team has defeated**.
  - _Note: This is a modified Buchholz system that specifically rewards wins against stronger opponents._
- **Ranking Order:** Teams are ranked by:
  1.  `score` (Descending)
  2.  `buchholzPoints` (Descending)

### Round Generation

- **Number of Rounds:** The maximum number of Swiss rounds is calculated as `ceil(log2(N))`, where `N` is the number of teams.
- **Pairing Algorithm:** The system uses standard Swiss pairing, attempting to match teams with identical or similar scores while avoiding Repeat Matches (teams cannot play the same opponent twice in the Swiss phase).
- **Byes:** If there is an odd number of teams, one team receives a "Bye" each round. A Bye counts as a win (1 point). No team can receive more than one Bye during the Swiss phase.

---

## 2. Transition to Elimination Phase

Once the maximum number of Swiss rounds is completed, the system determines which teams advance to the final tournament bracket.

### Advancement Criteria

The system automatically advances the top teams based on the Swiss rankings. The number of teams selected is the **highest power of two** that is less than or equal to the total number of teams ($2^{\lfloor \log_2(N) \rfloor}$).

- _Example 1:_ If there are 12 teams, the top **8** teams advance.
- _Example 2:_ If there are 16 teams, all **16** teams advance.
- _Example 3:_ If there are 20 teams, the top **16** teams advance.

---

## 3. Elimination Phase (Tournament Phase)

The Elimination Phase is a single-elimination bracket.

### Initial Layout (Seeding)

The initial matches (Round 0) are generated based on the final Swiss rankings (Seed 0 is the 1st ranked team, Seed 1 is the 2nd, etc.).

The seeding follows a "Snake" pairing logic to ensure high-seeded teams are distributed across the bracket and don't meet until later rounds. For $N$ advancing teams, the pairings are:

| Match       | Pairing (Seeds)      | Sum of Seeds |
| :---------- | :------------------- | :----------- |
| Match 1     | Seed 0 vs Seed $N-1$ | $N-1$        |
| Match 2     | Seed 2 vs Seed $N-3$ | $N-1$        |
| Match 3     | Seed 4 vs Seed $N-5$ | $N-1$        |
| ...         | ...                  | ...          |
| Match $N/2$ | Seed $N-2$ vs Seed 1 | $N-1$        |

**Example for 8 Teams:**

- Match 1: Seed 0 vs Seed 7 (1st vs 8th)
- Match 2: Seed 2 vs Seed 5 (3rd vs 6th)
- Match 3: Seed 4 vs Seed 3 (5th vs 4th)
- Match 4: Seed 6 vs Seed 1 (7th vs 2nd)

### Bracket Progression

The winners of Match 1 and Match 2 meet in the next round. The winners of Match 3 and Match 4 meet in the next round. This ensures that the 1st and 2nd seeds (Seed 0 and Seed 1) are in opposite halves of the bracket and can only meet in the final.
