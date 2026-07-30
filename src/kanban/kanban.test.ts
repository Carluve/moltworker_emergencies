import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv, KanbanCard } from '../types';
import { parseCreateBody, parseUpdateBody } from './validate';
import { internal } from '../routes/internal';
import { createMockEnv } from '../test-utils';

/**
 * In-memory fake implementing the D1 subset used by src/kanban/cards.ts.
 * Pattern-matches the exact SQL statements issued by the data layer.
 */
const byCreatedDesc = (a: KanbanCard, b: KanbanCard) =>
  b.created_at.localeCompare(a.created_at);

function createFakeD1() {
  const rows = new Map<string, KanbanCard>();

  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...p: unknown[]) {
          params = p;
          return stmt;
        },
        async all<T>() {
          const all = [...rows.values()];
          const filtered = sql.includes('WHERE status = ?')
            ? all.filter((r) => r.status === params[0])
            : all;
          const results = [...filtered].sort(byCreatedDesc);
          return { results: results as T[] };
        },
        async first<T>() {
          return (rows.get(params[0] as string) ?? null) as T | null;
        },
        async run() {
          if (sql.startsWith('INSERT INTO cards')) {
            const [id, title, description, status, priority, source, reporter, created_by] =
              params as [string, string, string, string, string, string, string | null, string];
            const now = new Date().toISOString();
            rows.set(id, {
              id,
              title,
              description,
              status: status as KanbanCard['status'],
              priority: priority as KanbanCard['priority'],
              source,
              reporter,
              created_by: created_by as KanbanCard['created_by'],
              created_at: now,
              updated_at: now,
            });
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('UPDATE cards SET')) {
            const id = params[params.length - 1] as string;
            const row = rows.get(id);
            if (!row) return { meta: { changes: 0 } };
            const setPart = sql.slice('UPDATE cards SET '.length, sql.indexOf(' WHERE'));
            setPart.split(',').forEach((field, i) => {
              const col = field.trim().split(' ')[0] as keyof KanbanCard;
              if (col !== 'updated_at') {
                (row as unknown as Record<string, unknown>)[col] = params[i];
              }
            });
            row.updated_at = new Date().toISOString();
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('DELETE FROM cards')) {
            return { meta: { changes: rows.delete(params[0] as string) ? 1 : 0 } };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      };
      return stmt;
    },
  };

  return { db: db as unknown as D1Database, rows };
}

// =============================================================================
// validate.ts
// =============================================================================

describe('parseCreateBody', () => {
  it('accepts a minimal valid body', () => {
    const result = parseCreateBody({ title: 'Flooding in sector 4' }, 'human');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Flooding in sector 4');
    expect(result.value.createdBy).toBe('human');
    expect(result.value.source).toBe('manual');
  });

  it('defaults source to "agent" for agent-created cards', () => {
    const result = parseCreateBody({ title: 'Fire' }, 'agent');
    expect(result.ok && result.value.source === 'agent').toBe(true);
  });

  it('rejects missing title', () => {
    expect(parseCreateBody({}, 'human').ok).toBe(false);
    expect(parseCreateBody({ title: '  ' }, 'human').ok).toBe(false);
    expect(parseCreateBody('nope', 'human').ok).toBe(false);
  });

  it('rejects invalid priority and status', () => {
    expect(parseCreateBody({ title: 'x', priority: 'urgent' }, 'human').ok).toBe(false);
    expect(parseCreateBody({ title: 'x', status: 'done' }, 'human').ok).toBe(false);
  });

  it('accepts all valid priorities and statuses', () => {
    for (const priority of ['critical', 'high', 'medium', 'low']) {
      expect(parseCreateBody({ title: 'x', priority }, 'human').ok).toBe(true);
    }
    for (const status of ['new', 'triaged', 'in_progress', 'resolved']) {
      expect(parseCreateBody({ title: 'x', status }, 'human').ok).toBe(true);
    }
  });
});

describe('parseUpdateBody', () => {
  it('accepts partial updates', () => {
    const result = parseUpdateBody({ status: 'resolved' });
    expect(result.ok && result.value.status === 'resolved').toBe(true);
  });

  it('rejects invalid values', () => {
    expect(parseUpdateBody({ status: 'archived' }).ok).toBe(false);
    expect(parseUpdateBody({ title: '' }).ok).toBe(false);
    expect(parseUpdateBody(null).ok).toBe(false);
  });
});

// =============================================================================
// /api/internal routes
// =============================================================================

describe('internal kanban routes', () => {
  const SECRET = 'test-agent-secret';
  let app: Hono<AppEnv>;
  let fake: ReturnType<typeof createFakeD1>;

  function req(path: string, init: RequestInit = {}, env = createFakeEnv()) {
    return app.request(path, init, env);
  }

  function createFakeEnv(overrides = {}) {
    return createMockEnv({
      KANBAN_AGENT_SECRET: SECRET,
      KANBAN_DB: fake.db,
      DEV_MODE: 'true',
      ...overrides,
    });
  }

  function authed(init: RequestInit = {}): RequestInit {
    const extraHeaders = (init.headers ?? {}) as Record<string, string>;
    return {
      ...init,
      headers: { Authorization: `Bearer ${SECRET}`, ...extraHeaders },
    };
  }

  beforeEach(() => {
    fake = createFakeD1();
    app = new Hono<AppEnv>();
    app.route('/api/internal', internal);
  });

  it('returns 503 when KANBAN_AGENT_SECRET is not configured', async () => {
    const res = await app.request(
      '/api/internal/kanban/cards',
      {},
      createMockEnv({ DEV_MODE: 'true', KANBAN_DB: fake.db }),
    );
    expect(res.status).toBe(503);
  });

  it('returns 401 without a valid bearer token', async () => {
    const res = await req('/api/internal/kanban/cards');
    expect(res.status).toBe(401);

    const res2 = await req(
      '/api/internal/kanban/cards',
      { headers: { Authorization: 'Bearer wrong' } },
      createFakeEnv(),
    );
    expect(res2.status).toBe(401);
  });

  it('returns 503 when KANBAN_DB is not bound', async () => {
    const res = await app.request(
      '/api/internal/kanban/cards',
      authed(),
      createMockEnv({ DEV_MODE: 'true', KANBAN_AGENT_SECRET: SECRET }),
    );
    expect(res.status).toBe(503);
  });

  it('creates a card with agent defaults', async () => {
    const res = await req(
      '/api/internal/kanban/cards',
      authed({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Bridge collapsed', priority: 'critical', source: 'telegram', reporter: '@bob' }),
      }),
    );
    expect(res.status).toBe(201);
    const { card } = (await res.json()) as { card: KanbanCard };
    expect(card.title).toBe('Bridge collapsed');
    expect(card.status).toBe('new');
    expect(card.created_by).toBe('agent');
    expect(card.source).toBe('telegram');
    expect(card.reporter).toBe('@bob');
  });

  it('rejects invalid create bodies', async () => {
    const res = await req(
      '/api/internal/kanban/cards',
      authed({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 'high' }),
      }),
    );
    expect(res.status).toBe(400);

    const resBadJson = await req(
      '/api/internal/kanban/cards',
      authed({ method: 'POST', body: 'not json' }),
    );
    expect(resBadJson.status).toBe(400);
  });

  it('lists cards and filters by status', async () => {
    const post = (title: string, status?: string) =>
      req(
        '/api/internal/kanban/cards',
        authed({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, status }),
        }),
      );
    await post('A');
    await post('B', 'in_progress');

    const all = await req('/api/internal/kanban/cards', authed());
    const { cards } = (await all.json()) as { cards: KanbanCard[] };
    expect(cards).toHaveLength(2);

    const filtered = await req('/api/internal/kanban/cards?status=in_progress', authed());
    const { cards: inProgress } = (await filtered.json()) as { cards: KanbanCard[] };
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0].title).toBe('B');

    const badFilter = await req('/api/internal/kanban/cards?status=nope', authed());
    expect(badFilter.status).toBe(400);
  });

  it('updates a card and returns 404 for unknown ids', async () => {
    const createRes = await req(
      '/api/internal/kanban/cards',
      authed({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Gas leak' }),
      }),
    );
    const { card } = (await createRes.json()) as { card: KanbanCard };

    const patchRes = await req(
      `/api/internal/kanban/cards/${card.id}`,
      authed({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress', priority: 'high' }),
      }),
    );
    expect(patchRes.status).toBe(200);
    const { card: updated } = (await patchRes.json()) as { card: KanbanCard };
    expect(updated.status).toBe('in_progress');
    expect(updated.priority).toBe('high');

    const missing = await req(
      '/api/internal/kanban/cards/does-not-exist',
      authed({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      }),
    );
    expect(missing.status).toBe(404);
  });
});
