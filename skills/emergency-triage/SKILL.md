---
name: emergency-triage
description: Triage emergencies reported through any channel (web, Telegram, WhatsApp) into the emergency kanban board — log needs and offers, assign case numbers, and propose matches between them. Use when a user reports an emergency, offers help/resources, or asks about ongoing emergencies. Requires KANBAN_AGENT_SECRET and WORKER_URL env vars.
---

# Emergency Triage

Manage the emergency kanban board hosted by the worker. Cards represent incidents:
`new` → `triaged` → `in_progress` → `resolved`, with priorities `critical | high | medium | low`.

Every card has a **type** — `need` (someone asks for help) or `offer` (someone offers
help/resources) — and a sequential **case number** (`case_num`) you must give back to the
reporter (e.g. "Caso #7 registrado").

## Prerequisites

- `KANBAN_AGENT_SECRET` env var (shared secret, already set in the container)
- `WORKER_URL` env var (public worker URL, e.g. `https://your-worker.workers.dev`)

All calls go to `$WORKER_URL/api/internal/kanban` with header
`Authorization: Bearer $KANBAN_AGENT_SECRET`.

## When to use

- A user reports an emergency/urgent incident in any channel → **create a `need` card**
  immediately, before or while replying.
- A user offers help, shelter, vehicles, tools, supplies → **create an `offer` card**.
- You start actively working on an incident → move it to `in_progress`.
- The incident is handled/closed → move it to `resolved`.
- The user asks "what emergencies are open?" → list cards and summarize.
- The user asks about their case by number → list cards and find the matching `case_num`.

## API

### Create a card

```bash
curl -s -X POST "$WORKER_URL/api/internal/kanban/cards" \
  -H "Authorization: Bearer $KANBAN_AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Short incident title",
    "description": "What happened, where, who is affected",
    "type": "need",
    "priority": "critical",
    "source": "telegram",
    "reporter": "@username or phone or name"
  }'
```

- `type`: `need` (default) or `offer` — ALWAYS set it explicitly.
- `source`: the channel the report came from (`web`, `telegram`, `whatsapp`, ...).
- `reporter`: who reported it (username, phone, name — whatever you know).
- Response: `{ "card": { "id": "...", "case_num": 7, ... } }` — keep the `id` to update the
  card later, and **always tell the reporter their `case_num`** in your reply
  (e.g. "Registrado como caso #7 · urgencia alta.").

### Update / move a card

```bash
curl -s -X PATCH "$WORKER_URL/api/internal/kanban/cards/<CARD_ID>" \
  -H "Authorization: Bearer $KANBAN_AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "status": "in_progress" }'
```

Updatable fields: `status`, `priority`, `title`, `description`, `reporter`.

### List cards

```bash
curl -s "$WORKER_URL/api/internal/kanban/cards?status=new" \
  -H "Authorization: Bearer $KANBAN_AGENT_SECRET"
```

Omit `?status=` to list all cards. Statuses: `new`, `triaged`, `in_progress`, `resolved`.

## Workflow

1. **Report received** → create card (`new`), acknowledge to the user with their case number
   ("Caso #7").
2. **Triage** → assess severity, set `priority`, move to `triaged`.
3. **Working on it** → move to `in_progress`, keep the card description updated with findings.
4. **Done** → move to `resolved` and tell the reporter.

## Matching needs with offers

Needs and offers share the same board. When you create or review a card:

1. List current cards (`?status=new`, also `triaged`) and look for a compatible counterpart —
   same kind of resource, plausible location, similar timing.
2. When you spot a candidate match, **do not close anything automatically**: append a note to
   BOTH card descriptions (e.g. `Propuesta de match: caso #7 ↔ caso #12 — taller a 6 km`) so a
   human coordinator can validate it. The coordinator confirms matches by dragging cards on
   the board; the final word is always human.
3. If the same incident is reported twice, do not create a second card — update the existing
   card's description with the new report and tell the second reporter the same case number.

Always create the card even if you can solve the issue immediately — the board is the
human operators' source of truth.

## Troubleshooting

- `401 Unauthorized`: `KANBAN_AGENT_SECRET` mismatch — report to the operator.
- `503 ... not configured`: the worker is missing the D1 binding or the secret — report to the operator.
- Empty `cards` array: no incidents yet — normal.
