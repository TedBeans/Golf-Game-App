export type Player = { id: string; name: string; index: number }; // WHS-style handicap index

export type Tee = { name: string; gender?: "M" | "W"; slope: number; rating: number; par?: number; yards?: number; conflicts?: string[] };

export type Course = {
  id: string;
  name: string;
  city?: string;
  lat?: number;
  lon?: number;
  osm?: { type: "way" | "relation" | "node"; id: number };
  tee?: string;
  teePar?: number; // 18-hole par for the chosen tee (rating - par needs this)
  tees?: Tee[]; // known tees for this course, when we have them
  pars: number[]; // 18
  strokeIndex: number[]; // 18, 1 = hardest
  yards?: (number | null)[];
  slope?: number;
  rating?: number;
  parsFromMap?: boolean;
  holesConfirmed?: boolean; // hole pars + stroke indexes are verified (from the course database) or confirmed by the user
};

export type RoundPlayer = Player & { courseHcp?: number }; // courseHcp = manual override (strokes)

export type Element = {
  id: string;
  kind: "bestBall" | "combined";
  /** total: lower team total over the segment wins. holes: team that wins more holes wins. */
  method: "total" | "holes" | "perHole";
  points: number;
};

export type Segment = { id: string; label: string; from: number; to: number }; // to exclusive

export type MatchPreset = "sixes" | "nassau" | "match" | "bestball" | "twopoint" | "custom";

export type MatchGame = {
  id: string;
  type: "match";
  preset: MatchPreset;
  name: string;
  /** rotate = Sixes style (4 players, partners change each segment); fixed = teamA vs teamB */
  format: "rotate" | "fixed";
  order: string[]; // rotate order (4)
  teamA: string[];
  teamB: string[];
  segments: Segment[];
  elements: Element[];
  stake: number; // $ per point, per player
  ties: "push" | "carry"; // carry: a tied element's points roll into the next segment (x2, x3...)
  maxCarry?: number; // biggest multiplier a carry can build to (2 = double). 0 or unset = no limit
};

export type SkinsGame = { id: string; type: "skins"; name: string; playerIds: string[]; stake: number; carryover: boolean; holes: number[] };
export type StrokeGame = { id: string; type: "stroke"; name: string; playerIds: string[]; stake: number; holes: number[] }; // stake = buy-in; winner takes pot
export type StablefordGame = { id: string; type: "stableford"; name: string; playerIds: string[]; stake: number; holes: number[] }; // $ per point, pairwise
export type WolfGame = {
  id: string; type: "wolf"; name: string; playerIds: string[]; stake: number; holes: number[];
  teamPts: number; lonePts: number; packPts: number; blindMult: number;
};
export type VegasGame = { id: string; type: "vegas"; name: string; teamA: string[]; teamB: string[]; stake: number; holes: number[] };
export type BingoGame = { id: string; type: "bingo"; name: string; playerIds: string[]; stake: number; holes: number[] };

export type Game = MatchGame | SkinsGame | StrokeGame | StablefordGame | WolfGame | VegasGame | BingoGame;
export type GameType = Game["type"];

export type SideBet = { id: string; label: string; amount: number; winnerId: string | null; hole?: number };

export type Round = {
  id: string;
  createdAt: number;
  date: string;
  course: Course;
  holes: 9 | 18;
  players: RoundPlayer[];
  scores: Record<string, (number | null)[]>;
  games: Game[];
  wolf: Record<string, ({ choice: string } | null)[]>;
  bingo: Record<string, ({ bingo?: string; bango?: string; bongo?: string } | null)[]>;
  sideBets: SideBet[];
  status: "active" | "final";
  demo?: boolean;
};

export type Payment = { id: string; date: number; fromId: string; toId: string; amount: number };
export type AppState = { version: 2; players: Player[]; rounds: Round[]; payments: Payment[] };

export type GameResult = {
  gameId: string;
  title: string;
  subtitle?: string;
  net: Record<string, number>; // zero-sum, +ve wins
  status: string; // one-line live status
  lines: string[];
  table?: { headers: string[]; rows: (string | number)[][] };
  warnings?: string[];
  /** Hole-by-hole point winners for per-hole team games (shown on the Card). */
  holeWins?: { segment: string; teams: [string, string]; rows: { hole: number; items: { label: string; winner: "A" | "B" | "tie" }[] }[] }[];
};

export type Transfer = { from: string; to: string; amount: number };
