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

## Accounts and cloud storage (Supabase)

Without any setup the app stores rounds in the browser on that device only. To require accounts and keep rounds in the cloud, shared with your crew:

1. Create a free project at supabase.com.
2. In **SQL Editor**, paste and run `supabase/schema.sql`.
3. In **Authentication > Providers**, keep Email enabled. For fastest testing turn off "Confirm email" (or leave it on and use the confirmation link).
4. In **Authentication > URL Configuration**, set Site URL to your Vercel URL and add it to Redirect URLs (used by password reset and confirmation emails).
5. In Vercel > Project Settings > Environment Variables add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase > Project Settings > API), then redeploy.

How it works: everyone signs in with email and password, then starts a crew or joins one with a 6 character invite code. A crew shares rounds, players and payments live between phones. Changes made with no signal are kept on the phone and upload when it reconnects. Demo rounds never leave the phone. Rounds saved on a phone before accounts existed can be added to the crew from the Home screen.
