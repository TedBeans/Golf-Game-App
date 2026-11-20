export type Player = {
  id: string;
  name: string;
  handicap: number; // course handicap in strokes (whole number)
};

export type Course = {
  id: string;
  name: string;
  city?: string;
  lat?: number;
  lon?: number;
  osm?: { type: "way" | "relation" | "node"; id: number };
  pars: number[]; // 18
  strokeIndex: number[]; // 18, 1 = hardest
  parsFromMap?: boolean;
};

export type GameType =
  | "skins"
  | "nassau"
  | "strokeplay"
  | "stableford"
  | "wolf"
  | "bingo"
  | "vegas";

export type ScoreBasis = "net" | "gross";

export type GameConfig = {
  id: string;
  type: GameType;
  label?: string;
  /** Dollar value. Meaning depends on the game (per skin, per bet, per stroke, per point...). */
  stake: number;
  basis: ScoreBasis;
  /** Which players take part (defaults to everybody). */
  playerIds: string[];
  // Skins
  carryover?: boolean;
  // Vegas
  teamA?: string[];
  teamB?: string[];
  // Nassau
  nassauFront?: boolean;
  nassauBack?: boolean;
  nassauOverall?: boolean;
};

/** Side bets: one entry per contest (closest to pin, long drive, greenie, custom...) */
export type SideBet = {
  id: string;
  label: string;
  amount: number; // every other player pays this to the winner
  winnerId: string | null;
  hole?: number; // 1-18, optional
};

export type WolfPick = {
  /** "lone", "blind" or a partner's player id */
  choice: "lone" | "blind" | string;
};

export type Round = {
  id: string;
  createdAt: number;
  date: string; // YYYY-MM-DD
  course: Course;
  holes: 9 | 18;
  playerIds: string[]; // order matters (wolf rotation, scorecard order)
  /** Snapshot of players so history survives edits. */
  players: Player[];
  handicapMode: "full" | "offLow" | "none";
  /** scores[playerId][holeIndex] = strokes or null */
  scores: Record<string, (number | null)[]>;
  games: GameConfig[];
  /** wolf picks per hole index (by game id) */
  wolf: Record<string, (WolfPick | null)[]>;
  /** bingo bango bongo: bingo[gameId][holeIndex] = {bingo, bango, bongo} player ids */
  bingo: Record<string, ({ bingo?: string; bango?: string; bongo?: string } | null)[]>;
  sideBets: SideBet[];
  status: "active" | "final";
};

export type Payment = {
  id: string;
  date: number;
  fromId: string; // payer
  toId: string; // receiver
  amount: number;
  note?: string;
};

export type AppState = {
  version: 1;
  players: Player[]; // friend roster
  rounds: Round[];
  payments: Payment[];
};

export type GameResult = {
  gameId: string;
  title: string;
  /** zero-sum: positive = wins, negative = owes */
  net: Record<string, number>;
  lines: string[]; // human readable breakdown
  /** optional mini table for display */
  table?: { headers: string[]; rows: (string | number)[][] };
  warnings?: string[];
};

export type Transfer = { from: string; to: string; amount: number };
