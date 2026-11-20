# Press — golf gambling tracker

Mobile-first app for running side games on the course and settling up afterwards. Built with Next.js (App Router) and deployable to Vercel with no environment variables.

## What it does
- **Courses near you** – search by location, city or ZIP (OpenStreetMap), or enter a course by hand with tee, slope, rating and hole pars/stroke indexes.
- **Handicaps: off the low man only.** Course handicap = index × slope/113 + (rating − par); the lowest plays to 0 and everyone else gets the difference. Strokes fall by stroke index. All scoring is net.
- **Scoring elements** – build each team game from pieces: best ball, combined score, match play (holes won), or the **two-point game** (1 pt combined score + 1 pt best ball, handicaps included). Sixes rotate partners every segment; Nassau, match and team games use fixed teams.
- **Other games** – Skins (carryover), stroke play pot, Stableford, Wolf, Vegas, Bingo Bango Bongo, side bets.
- **Money** – every round is zero-sum, shows who pays who in the fewest payments, and a running ledger tracks balances and recorded payments.
- Recap text to share, JSON export/import, and a demo round to try everything.

## Data
Everything is stored in the browser (localStorage). Use Export/Import on the Players tab to move data between phones. There is no backend or live sharing yet.

## Develop
```
npm install
npm run dev      # http://localhost:3000
npm test         # engine tests (vitest)
npm run typecheck
```

## Deploy
Import the repo in Vercel and deploy. No configuration needed.
