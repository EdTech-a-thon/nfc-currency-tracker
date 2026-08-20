# Decisions

- Data lives in PocketBase and the browser talks to it directly through the SDK. There is no API layer in this app: ownership is enforced by API rules on each collection, so a rule cannot be forgotten in one query the way a `WHERE` clause can.
- Ledger writes are hook-only. `transactions` and `purchase_lines` have no create, update, or delete rules, so balances can only move through the routes in `pb_hooks/`, which run inside a PocketBase transaction and check the balance, stock, and idempotency key first. A signed-in teacher cannot post to the ledger directly.
- Card taps resolve through a hook rather than a readable collection. The card's token is the only credential, so the route works without an account and returns a read-only view; teacher controls appear only when the owning teacher's own token accompanies the request.
- Short codes are only unique per teacher, so typing one resolves a card only for the signed-in teacher who owns it. Full card tokens stay readable by anyone holding the card, as before.
- Teacher accounts are a PocketBase auth collection. The previous session table and password hashing are gone; PocketBase issues and checks the tokens. Signing up creates a starting class and three award buttons through an `onRecordAfterCreateSuccess` hook.
- Screens check who is signed in when they load and redirect if nobody is, which is the expected pattern for an app with no server-side rendering of its own data.
- PocketBase has no nullable number, so "unlimited stock" is a `trackStock` flag beside the `stock` count rather than a null.
- Store item display order is no longer forced to be unique. The uniqueness constraint only ever protected the ordering, and made two teachers saving at once fail for no useful reason; items sort by `sortOrder` then name.
- Undo deletes the transaction and returns any purchased stock, so the self-referencing correction link on transactions is gone. Nothing read it except an "is this already undone" check that the deletion answers by itself.
- The local PocketBase runs on port 8092 rather than the usual 8090, because other projects on this machine already hold 8090 and 8091.
- The school-year delete flow only removes archived classes, deletes their students and ledger rows, and leaves the permanent card records intact. Teachers must type `DELETE <year>`.
- Card short codes use `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`; ambiguous `0`, `O`, `1`, and `I` are excluded.
- Award writes are queued in browser storage on network failure and retain a unique idempotency key. Business-rule failures remain visible for explicit retry instead of being discarded.
- Transactions remain the sole balance source. Checkout uses one `PURCHASE` transaction plus immutable purchase-line snapshots.
- Rate limiting is left to PocketBase rather than the app, since the browser now reaches PocketBase without passing through the app at all.
- A stable `NEXT_PUBLIC_CARD_BASE_URL` can differ from the application domain; Caddy must list both hostnames if they differ.
