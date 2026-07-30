import {
  KANBAN_PRIORITIES,
  KANBAN_STATUSES,
  type KanbanCard,
  type KanbanPriority,
  type KanbanStatus,
} from '../types';

/**
 * D1 data layer for the emergency kanban board.
 * All functions take the D1 binding explicitly so they are trivial to mock in tests.
 */

export interface CreateCardInput {
  title: string;
  description?: string;
  priority?: KanbanPriority;
  status?: KanbanStatus;
  source?: string;
  reporter?: string;
  createdBy: 'human' | 'agent';
}

export interface UpdateCardInput {
  title?: string;
  description?: string;
  priority?: KanbanPriority;
  status?: KanbanStatus;
  reporter?: string;
}

export function isValidStatus(value: unknown): value is KanbanStatus {
  return typeof value === 'string' && (KANBAN_STATUSES as readonly string[]).includes(value);
}

export function isValidPriority(value: unknown): value is KanbanPriority {
  return typeof value === 'string' && (KANBAN_PRIORITIES as readonly string[]).includes(value);
}

export async function listCards(db: D1Database, status?: KanbanStatus): Promise<KanbanCard[]> {
  const stmt = status
    ? db.prepare('SELECT * FROM cards WHERE status = ? ORDER BY created_at DESC').bind(status)
    : db.prepare('SELECT * FROM cards ORDER BY created_at DESC');
  const { results } = await stmt.all<KanbanCard>();
  return results ?? [];
}

export async function getCard(db: D1Database, id: string): Promise<KanbanCard | null> {
  return db.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first<KanbanCard>();
}

export async function createCard(db: D1Database, input: CreateCardInput): Promise<KanbanCard> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO cards (id, title, description, status, priority, source, reporter, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.title,
      input.description ?? '',
      input.status ?? 'new',
      input.priority ?? 'medium',
      input.source ?? 'manual',
      input.reporter ?? null,
      input.createdBy,
    )
    .run();
  const card = await getCard(db, id);
  if (!card) throw new Error('Failed to read back created card');
  return card;
}

export async function updateCard(
  db: D1Database,
  id: string,
  input: UpdateCardInput,
): Promise<KanbanCard | null> {
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (input.title !== undefined) {
    fields.push('title = ?');
    values.push(input.title);
  }
  if (input.description !== undefined) {
    fields.push('description = ?');
    values.push(input.description);
  }
  if (input.priority !== undefined) {
    fields.push('priority = ?');
    values.push(input.priority);
  }
  if (input.status !== undefined) {
    fields.push('status = ?');
    values.push(input.status);
  }
  if (input.reporter !== undefined) {
    fields.push('reporter = ?');
    values.push(input.reporter);
  }

  if (fields.length === 0) {
    return getCard(db, id);
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const result = await db
    .prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  if (!result.meta.changes) return null;
  return getCard(db, id);
}

export async function deleteCard(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}
