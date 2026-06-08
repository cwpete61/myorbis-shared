# myorbis-shared

Shared packages across the MyOrbis portfolio (Voice, Reviews, Local, Hub, Storefront).
Consumed via pnpm git dependency — no registry needed.

## Packages
- **@myorbis/hub-client** — typed client for the Account Hub (entitlements, Business DNA, partner ledger). Cache + degrade-to-stale built in.

Each consumer: `pnpm add "github:cwpete61/myorbis-shared#main&path:/packages/hub-client"`
