# TEC Connection — Claude Code Instructions

> ⚡ **SESSION START:** اقرأ `knowledge-base/C-02___CURRENT_STATE_.md` + **app charter
> `knowledge-base/C-107___CONNECTION_INSTITUTIONAL_CHARTER.md`** من `yasira82/tec-knowledge-base`.

## What This App Is

**System of Record (Relationships)** for the TEC Federated Platform — the
**Economic Relationship Infrastructure** (the Trust Graph). Connection models how
users and businesses relate: the **social + business graph** (follow / connect),
**trust signals** derived from real economic activity, **reputation**, and
**collaboration context**. It is the relationship baseline the rest of the ecosystem
reads — without Connection, Explorer has nothing to discover, TEC AI has no social
context, and Commerce has no reputation signal (C-107).

Built from `tec-template-base` (Next.js 15 frontend). A user's connections are
**sovereign** — self-declared and private; the user controls who they trust and who
can see it.

**Current Phase: Phase 0 — customized from template.** Identity/domain/slug/legal +
themed home shell done. Login (C-123 landing) + the first feature slice (Follow /
Connect) are the next steps. Deployed (Mainnet) · Pi App ID registered · env set · payment live · referral growth loop wired (C-133).

---

## Pi App Identity

| Field | Value |
|-------|-------|
| **App** | TEC Connection |
| **Domain** | `https://connection.tecosystem.app` |
| **Pi App ID** | `connection-aa9fba4f11664096` ✅ Registered · Vercel `NEXT_PUBLIC_PI_APP_ID` |
| **APP_SOURCE slug** | `connection` (payment-service resolves `PI_API_KEY_CONNECTION`) |
| **PI_SANDBOX** | `false` (Mainnet) |

---

## Connection-Specific Rules (C-107)

### Data ownership boundary
Connection **OWNS**: the social graph (follow/connect edges), the business graph,
trust signals, reputation scores, and collaboration context. Connection does
**NOT OWN**: identity truth (`tec-auth-service`), payment truth
(`tec-payment-service`), asset ownership (`tec-asset-service`), discovery/search
(Explorer, C-108), or recommendations (TEC AI, C-104). Read those as **ID-only
references** — never re-derive or mutate them.

### Consistency model
- **Self-declared** edges (follow / connect / block) = **strong** consistency — the user controls them.
- **Activity-inferred** trust signals (from `payment.completed.v1` etc.) = **eventual** consistency.
- Reputation is a derived projection — never presented as financial truth.

### Trust is earned, not claimed
Trust signals derive from **real economic activity** (completed payments,
fulfilled orders, repeated collaboration) — never vanity metrics. The owning
service (payment/commerce) is the source of truth; Connection only aggregates the
*relationship* meaning of those facts.

### Privacy / sovereignty
- A user's graph is sovereign — the user controls what any other app (esp. TEC AI / Explorer) may see.
- Right to disconnect / block, and to purge social edges (payment records stay with payment-service).
- Identity anchor = `tec_user.piUsername` (permanent Pi identity) — edges survive identity migration.

### Isolation (P6)
A user sees/mutates ONLY their own edges — derive identity from the `tec_user`
session cookie server-side, **never** from a query param or request body. No session
→ no data (fail closed).

**Reference of record:** `yasira82/tec-knowledge-base` —
`C-107___CONNECTION_INSTITUTIONAL_CHARTER.md` (charter) + `C-12_Dual_Mode_Payment.md`
(payment anti-regression) + `C-123` (session/cookies).

---

## Stack

- Next.js 15 App Router + TypeScript strict · React 18
- `@yasser172/tec-ui` (design system) · `@yasser172/tec-auth` · `@yasser172/tec-sdk`
- Vitest (unit) + Playwright (e2e) · Deployment: Vercel

---

## Architecture Rules (non-negotiable)

### CSRF — middleware ONLY (P2 single source of truth)
CSRF is enforced in **`middleware.ts`** and **nowhere else**: a request is trusted
if the double-submit token matches **OR** it is first-party (Origin host === Host /
`*.tecosystem.app`).
- ❌ **NEVER** add a CSRF check inside a route handler (`csrfCookie !== csrfHeader`
  → 403). It 403's legit Mode-2 payments in Pi Browser (drops `sameSite=None`
  cookies). The CI `payment-policy` job fails the build if you do. (KB C-12 §11)
- ✅ A route may *forward* `x-csrf-token` to a downstream call; it must never *validate* it.

### ADR-007 — Dual-mode payment (Pi foreign session)
Every buy handler MUST guard before touching `window.Pi`:
```typescript
const isHubNavigation = () =>
  document.referrer.toLowerCase().includes('hub.tecosystem.app');
if (isHubNavigation() || !(window as any).Pi || !piReady) {
  redirectToHubPayment(...);   // Mode 1: Hub modal → /hub?pay=1&...
  return;
}
// Mode 2: standalone — createPaymentRecord() then createU2APayment() (src/lib/pi-payment.ts)
```

### ADR-009 — Unified payment contract
`amount` is a **number**; gateway path is **`/api/payment/*`** (singular); the only
inter-service header is **`x-internal-key`** + `INTERNAL_SECRET`. Don't re-declare
payment Zod locally — shapes live in `@yasser172/tec-sdk`.

### Two-SDK boundary
```
Client components → src/lib-client/*  (browser state, Pi hooks)
API routes (BFF)  → @yasser172/tec-sdk via /api/bff/*  (server-only)
```

### Auth / cookies (LOCKED)
SSO via Hub cookies `tec_access_token`, `tec_csrf`, `tec_user`. Never localStorage.
Identity is derived from the `tec_user` cookie server-side — **never from the request body**.

---

## Setup status + Roadmap (C-107)

```
Phase 0 — customized from template:
  ✅ package.json name = tec-connection · APP_SOURCE = 'connection'
  ✅ sso-callback ALLOWED_AUDIENCES → connection.tecosystem.app + tec-connection.vercel.app
  ✅ privacy + terms → TEC Connection / connection.tecosystem.app
  ✅ NEW-A: no NEXT_PUBLIC_API_GATEWAY_URL / Railway host in the client bundle
  ✅ layout Pi init is hub-entry-aware (C-12 §3 / ADR-007 foreign-session skip)
  ✅ landing + /app themed as the Connection home shell (Connections · Trust · Collaboration)
  ✅ full-bleed dark shell (no white frame): color-scheme dark + theme-color + html/body reset

Next (before live):
  ✅ Pi App ID registered: connection-aa9fba4f11664096 · Vercel vars set
    (API_GATEWAY_URL · INTERNAL_SECRET · SSO_SECRET · NEXT_PUBLIC_PI_APP_ID · PI_SANDBOX=false).
  ✅ Hub SSO: connection.tecosystem.app + tec-connection.vercel.app added to the Hub
    /api/auth/sso ALLOWED_TARGETS; Connection added to the Hub domain registry (Live Now) — merged to tec-app main.
  ✅ FEATURE slice 1 — Follow / Connect (self-declared social graph, strong consistency):
    Follow store in tec-identity-service (Follow model + @Controller
    'identity/connection') behind /api/bff/connection/* → /api/identity/connection/*.
    Interactive follow/unfollow + following/followers counts in /app. Follower =
    session identity (never a param); followee by Pi username. Needs: identity-service
    deployed (connection_follows via db push).
  □ Deploy to Vercel + runtime-verify login + a follow/unfollow round-trip in Pi Browser.
  □ FEATURE slice 2 — Trust signals (eventual): consume payment.completed.v1 /
    order.created.v1 into relationship trust signals; PRESENT them (never re-derive
    transaction truth — C-107 boundary).
  □ FEATURE slice 3+ — reputation projection + collaboration context.
```

> Payment scaffold (`src/lib/pi-payment.ts`, ADR-007 guard) is kept for compliance +
> optionality. Connection monetization is expected to be subscription-via-Hub (like
> Life/Analytics); if a direct buy is added it MUST keep the `isHubNavigation()` guard,
> and payment-service MUST have `PI_API_KEY_CONNECTION` wired (C-12 §11 / approve→502).

---

## What NOT To Do

- Do NOT validate CSRF in a route handler — middleware only (CI blocks it)
- Do NOT send `amount` as a string, or use `/payments` / `x-service-secret`
- Do NOT skip the ADR-007 `isHubNavigation()` guard before `window.Pi`
- Do NOT store tokens in localStorage; do NOT derive identity from the body
- Do NOT add `NEXT_PUBLIC_*` for internal service URLs or `INTERNAL_SECRET`
- Do NOT present trust/reputation as financial truth — owning service is the source
- Do NOT re-derive or mutate identity/payment/asset truth — reference by ID only

---

## Commit Convention

```
feat(connection):  new relationship feature   fix(payment): payment flow fix (test carefully)
fix(connection):   bug fix                     chore(scope):  build/config
```

---

## Skills

Available via plugin — invoke automatically when the situation matches:

| Situation | Skill |
|-----------|-------|
| Writing new feature or fixing a bug → use TDD | `/tdd` |
| Bug, regression, or unexpected behavior | `/diagnose` |
| Writing or modifying tests | `/test-guard` |
| Writing or modifying BFF routes, payment handlers, or API contracts | `/clean-code-guard` |
| Updating docs, CLAUDE.md, or knowledge-base entries | `/docs-guard` |
| Planning a new feature or architectural decision | `/grill-with-docs` |
| Breaking down a roadmap item into GitHub Issues | `/to-issues` |
| Session is getting long or context is filling up | `/handoff` |
| Adding pre-commit hooks to this repo | `/setup-pre-commit` |
