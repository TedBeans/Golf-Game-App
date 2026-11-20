# Golf Game

Mobile-first web app for running gambling games on the golf course with your friends. Pick a course near you, keep score hole by hole, run several games at once, and see the running balance and who owes who.

## Features
- **Courses near you**: uses your location or a city/ZIP search (OpenStreetMap data via Overpass). Pars and stroke index are pulled from the map when tagged; otherwise editable defaults. You can also type a course in manually.
- **Games** (run any combination at the same time): Skins (optional carryover), Nassau, Stroke play ($/stroke), Stableford ($/point), Wolf, Bingo Bango Bongo, Vegas, plus side bets (closest to pin, long drive, greenies, custom).
- **Scoring**: net or gross per game; full handicaps, play off the low handicap, or none. 9 or 18 holes.
- **Money**: per-round totals, lifetime balances, the fewest payments that square everyone up, and a payment log so "mark paid" reduces what's owed.
- **Backup**: data is stored in the browser (localStorage). Export/import JSON from the Players page.

## Game rules as implemented
| Game | Stake means | Settlement |
|---|---|---|
| Skins | $ per skin, from each other player | Unique low score wins; ties carry (optional) |
| Nassau | $ per bet (front, back, overall) | Lowest total wins from each other player; ties push |
| Stroke play | $ per stroke | Every pair settles the stroke difference |
| Stableford | $ per point | Every pair settles the point difference |
| Wolf | $ per point | Partner win = 1 pt each; lone win = 3; lone loss = 1 each to the pack; blind doubles. Pairs settle point difference |
| Bingo Bango Bongo | $ per point | Every pair settles the point difference |
| Vegas | $ per point, per player | Team scores combine low-high; difference is the swing. No birdie flip |

## Develop
```bash
npm install
npm run dev      # http://localhost:3000
npm test         # game and settlement logic
npm run build
```

## Deploy
Import the repo in Vercel (framework: Next.js, no env vars needed) or run `npx vercel`.
