import {
  isValidCardType,
  isValidPriority,
  isValidStatus,
  type CreateCardInput,
  type UpdateCardInput,
} from './cards';

/**
 * Request-body validation shared by the admin and internal kanban routers.
 * Returns either a typed input or an error message.
 */

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseCreateBody(
  body: unknown,
  createdBy: 'human' | 'agent',
): ParseResult<CreateCardInput> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.title !== 'string' || b.title.trim().length === 0) {
    return { ok: false, error: 'title is required and must be a non-empty string' };
  }
  if (b.title.length > 200) {
    return { ok: false, error: 'title must be 200 characters or less' };
  }
  if (b.description !== undefined && typeof b.description !== 'string') {
    return { ok: false, error: 'description must be a string' };
  }
  if (b.type !== undefined && !isValidCardType(b.type)) {
    return { ok: false, error: 'type must be one of: need, offer' };
  }
  if (b.priority !== undefined && !isValidPriority(b.priority)) {
    return { ok: false, error: 'priority must be one of: critical, high, medium, low' };
  }
  if (b.status !== undefined && !isValidStatus(b.status)) {
    return { ok: false, error: 'status must be one of: new, triaged, in_progress, resolved' };
  }
  if (b.source !== undefined && (typeof b.source !== 'string' || b.source.length > 50)) {
    return { ok: false, error: 'source must be a string of 50 characters or less' };
  }
  if (b.reporter !== undefined && b.reporter !== null && typeof b.reporter !== 'string') {
    return { ok: false, error: 'reporter must be a string' };
  }

  return {
    ok: true,
    value: {
      title: b.title.trim(),
      description: b.description as string | undefined,
      type: b.type as CreateCardInput['type'],
      priority: b.priority as CreateCardInput['priority'],
      status: b.status as CreateCardInput['status'],
      source: (b.source as string | undefined) ?? (createdBy === 'agent' ? 'agent' : 'manual'),
      reporter: (b.reporter as string | null | undefined) ?? undefined,
      createdBy,
    },
  };
}

export function parseUpdateBody(body: unknown): ParseResult<UpdateCardInput> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const value: UpdateCardInput = {};

  if (b.title !== undefined) {
    if (typeof b.title !== 'string' || b.title.trim().length === 0 || b.title.length > 200) {
      return { ok: false, error: 'title must be a non-empty string of 200 characters or less' };
    }
    value.title = b.title.trim();
  }
  if (b.description !== undefined) {
    if (typeof b.description !== 'string') {
      return { ok: false, error: 'description must be a string' };
    }
    value.description = b.description;
  }
  if (b.priority !== undefined) {
    if (!isValidPriority(b.priority)) {
      return { ok: false, error: 'priority must be one of: critical, high, medium, low' };
    }
    value.priority = b.priority;
  }
  if (b.status !== undefined) {
    if (!isValidStatus(b.status)) {
      return { ok: false, error: 'status must be one of: new, triaged, in_progress, resolved' };
    }
    value.status = b.status;
  }
  if (b.reporter !== undefined) {
    if (b.reporter !== null && typeof b.reporter !== 'string') {
      return { ok: false, error: 'reporter must be a string or null' };
    }
    value.reporter = b.reporter as string;
  }

  return { ok: true, value };
}
