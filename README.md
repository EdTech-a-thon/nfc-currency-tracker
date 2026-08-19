# NFC Currency Tracker

A self-hosted classroom reward economy for reusable NFC and short-code cards. Teachers award whole-number classroom currency, run a store, and keep an immutable transaction history. Students do not have accounts and cannot move credit.

## How it fits together

Data lives in [PocketBase](https://pocketbase.io). The browser talks to it directly through the PocketBase SDK; there is no separate API layer in this app. Who may read or change each record is set by API rules on the collections themselves, and anything that has to weigh a balance or change several records at once runs as a PocketBase hook in `pb_hooks/`, so those rules cannot be bypassed by calling the collections directly.

- `pb_migrations/` — the schema, one file per change, applied automatically wherever the project runs.
- `pb_hooks/` — awards, adjustments, undo, checkout, card issuing and assignment, and the public card tap route.

## Local setup

Requirements: Node.js 22+ and npm.

```sh
npm install
npm run pb:install       # downloads the pinned PocketBase release, once
cp .env.example .env.local
```

Run PocketBase and the app in two terminals:

```sh
npm run pb               # PocketBase on http://127.0.0.1:8092
npm run dev              # the app
```

The first run applies the migrations and creates an empty database. Create the first teacher with **Create a teacher account** on the login page; signing up sets up a starting class with three award buttons. PocketBase's own admin screens are at <http://127.0.0.1:8092/_/>, where you can review accounts and data directly.

Useful checks:

```sh
npm run typecheck
npm test                 # needs `npm run pb` running
npm run build
```

## Environment variables

- `PUBLIC_POCKETBASE_URL`: where the browser reaches PocketBase. `http://127.0.0.1:8092` locally; the PocketBase hostname in production.
- `PUBLIC_CARD_BASE_URL`: permanent public HTTPS origin encoded on physical cards. Decide this before writing cards.
- `DOMAIN`: public app hostname used by Caddy, without a protocol.
- `POCKETBASE_DOMAIN`: public PocketBase hostname used by Caddy, without a protocol.

Both `PUBLIC_` values are read when the app is built, so a production build needs them set at build time.

See `.env.example` for examples and `SETUP.md` for the full VM, HTTPS, GitHub deployment, backup, and restore runbook.

## Setting up your card set

Cards store only a URL. Names, assignments, balances, and history always stay in PocketBase, so a card can be returned to the available pool and assigned to a different student without carrying any balance.

1. In a classroom, open **Cards** and generate the required number.
2. Open **Encoding sheet**. Match each printed card label to its permanent URL.
3. On an iPhone, use any free NFC writer app to write the matching URL to each chip once.
4. Test the card, then lock the tag after writing so its permanent identifier cannot be changed accidentally.
5. Label each physical card with its matching card number and short code. No student name is needed because cards are reused.
6. Assign cards to students manually or with sequential auto-assign.

Blank NTAG215 cards and re-encodable hotel keycards both work. Confirm that hotel cards are writable before buying a set. iPhones open the written URL through background NFC reading without an installed app. The four-character code remains a backup for damaged cards and for devices that cannot read NFC.

Never change `PUBLIC_CARD_BASE_URL` after chips have been written and locked. The path is deliberately short: `/c/<permanent-token>`.

## Production deployment

The three-service Docker Compose stack includes the app, PocketBase, and Caddy automatic HTTPS. PocketBase applies any new migrations from `pb_migrations/` itself on start, so there is no separate migration step. Run:

```sh
cp .env.example .env
# Edit every production value first.
docker compose up -d --build
```

`deploy.sh` safely pulls, rebuilds, restarts, and checks health. `.github/workflows/deploy.yml` runs checks before invoking that script over SSH. Exact first-install and secret instructions are in `SETUP.md`.

## Main workflows

- Teacher signup, login, class switching, archiving, restoring, and school-year deletion.
- Paste or CSV roster import, student editing/deactivation, bulk class transfer, and balance sorting.
- Permanent card generation, encoding CSV, print sheets, assignment, reset, lost/retired state, and replacement.
- Multi-student quick awards with optimistic balances, visible sync state, queued retry, and idempotency.
- Manual short-code lookup, teacher-aware iPhone card links, and roster fallback.
- Manual adjustment with required reason, compensating undo, full student history, store editing, stocked checkout, and CSV export.
- Fast read-only student balance, activity, and affordability view.
