---
name: emergency-triage
description: Triage emergencies reported through any channel (web, Telegram, WhatsApp) into the emergency kanban board. Use when a user reports an emergency, incident, or urgent situation, or when asked to check/update the status of ongoing emergencies. Requires KANBAN_AGENT_SECRET and WORKER_URL env vars.
---

# Emergency Triage

Manage the emergency kanban board hosted by the worker. Cards represent incidents:
`new` → `triaged` → `in_progress` → `resolved`, with priorities `critical | high | medium | low`.

## Prerequisites

- `KANBAN_AGENT_SECRET` env var (shared secret, already set in the container)
- `WORKER_URL` env var (public worker URL, e.g. `https://your-worker.workers.dev`)

All calls go to `$WORKER_URL/api/internal/kanban` with header
`Authorization: Bearer $KANBAN_AGENT_SECRET`.

## When to use

- A user reports an emergency/urgent incident in any channel → **create a card** immediately,
  before or while replying.
- You start actively working on an incident → move it to `in_progress`.
- The incident is handled/closed → move it to `resolved`.
- The user asks "what emergencies are open?" → list cards and summarize.

## API

### Create a card

```bash
curl -s -X POST "$WORKER_URL/api/internal/kanban/cards" \
  -H "Authorization: Bearer $KANBAN_AGENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Short incident title",
    "description": "What happened, where, who is affected",
    "priority": "critical",
    "source": "telegram",
    "reporter": "@username or phone or name"
  }'
```

- `source`: the channel the report came from (`web`, `telegram`, `whatsapp`, ...).
- `reporter`: who reported it (username, phone, name — whatever you know).
- Response: `{ "card": { "id": "...", ... } }` — keep the `id` to update the card later.

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

1. **Report received** → create card (`new`), acknowledge to the user with the card reference.
2. **Triage** → assess severity, set `priority`, move to `triaged`.
3. **Working on it** → move to `in_progress`, keep the card description updated with findings.
4. **Done** → move to `resolved` and tell the reporter.

Always create the card even if you can solve the issue immediately — the board is the
human operators' source of truth.

## Troubleshooting

- `401 Unauthorized`: `KANBAN_AGENT_SECRET` mismatch — report to the operator.
- `503 ... not configured`: the worker is missing the D1 binding or the secret — report to the operator.
- Empty `cards` array: no incidents yet — normal.
