import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { createCard, listCards, updateCard } from '../kanban/cards';
import { parseCreateBody, parseUpdateBody } from '../kanban/validate';
import { isValidStatus } from '../kanban/cards';

/**
 * Internal API routes for the OpenClaw agent (mounted at /api/internal).
 *
 * These routes are NOT protected by Cloudflare Access. Instead they require
 * a shared secret via `Authorization: Bearer <KANBAN_AGENT_SECRET>`.
 * The secret is passed to the container as an env var so the agent can call
 * these endpoints from inside the sandbox (see skills/emergency-triage).
 *
 * Mounted BEFORE the CF Access middleware in index.ts.
 */
const internal = new Hono<AppEnv>();

// Auth middleware: shared-secret bearer token
internal.use('*', async (c, next) => {
  const secret = c.env.KANBAN_AGENT_SECRET;
  if (!secret) {
    return c.json({ error: 'Internal API not configured (KANBAN_AGENT_SECRET missing)' }, 503);
  }
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== secret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
});

// Guard: D1 must be bound
internal.use('/kanban/*', async (c, next) => {
  if (!c.env.KANBAN_DB) {
    return c.json({ error: 'Kanban database not configured (KANBAN_DB binding missing)' }, 503);
  }
  return next();
});

// GET /api/internal/kanban/cards - List cards (optionally filtered by status)
internal.get('/kanban/cards', async (c) => {
  const statusParam = c.req.query('status');
  if (statusParam !== undefined && !isValidStatus(statusParam)) {
    return c.json({ error: 'status must be one of: new, triaged, in_progress, resolved' }, 400);
  }
  const cards = await listCards(c.env.KANBAN_DB!, statusParam);
  return c.json({ cards });
});

// POST /api/internal/kanban/cards - Create a card (created_by=agent)
internal.post('/kanban/cards', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = parseCreateBody(body, 'agent');
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, 400);
  }

  const card = await createCard(c.env.KANBAN_DB!, parsed.value);
  return c.json({ card }, 201);
});

// PATCH /api/internal/kanban/cards/:id - Update a card (status, priority, ...)
internal.patch('/kanban/cards/:id', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = parseUpdateBody(body);
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, 400);
  }

  const card = await updateCard(c.env.KANBAN_DB!, c.req.param('id'), parsed.value);
  if (!card) {
    return c.json({ error: 'Card not found' }, 404);
  }
  return c.json({ card });
});

export { internal };
