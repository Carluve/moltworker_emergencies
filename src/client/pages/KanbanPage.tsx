import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listKanbanCards,
  createKanbanCard,
  updateKanbanCard,
  deleteKanbanCard,
  AuthError,
  type KanbanCard,
  type KanbanPriority,
  type KanbanStatus,
} from '../api';
import './KanbanPage.css';

const COLUMNS: Array<{ status: KanbanStatus; label: string }> = [
  { status: 'new', label: 'New' },
  { status: 'triaged', label: 'Triaged' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'resolved', label: 'Resolved' },
];

const PRIORITIES: KanbanPriority[] = ['critical', 'high', 'medium', 'low'];

const REFRESH_INTERVAL_MS = 15000;

function formatTimeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function KanbanPage() {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<KanbanPriority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const draggedCardId = useRef<string | null>(null);

  const fetchCards = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      setError(null);
      const data = await listKanbanCards();
      setCards(data.cards || []);
    } catch (err) {
      if (err instanceof AuthError) {
        setError('Authentication required. Please log in via Cloudflare Access.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch cards');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards(true);
    const interval = setInterval(() => fetchCards(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCards]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await createKanbanCard({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
      });
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setShowCreateForm(false);
      await fetchCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMove = async (cardId: string, status: KanbanStatus) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.status === status) return;
    // Optimistic update
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status } : c)));
    try {
      await updateKanbanCard(cardId, { status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move card');
      await fetchCards();
    }
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm('Delete this card?')) return;
    try {
      await deleteKanbanCard(cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete card');
    }
  };

  const onDragStart = (cardId: string) => (e: React.DragEvent) => {
    draggedCardId.current = cardId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (status: KanbanStatus) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggedCardId.current) {
      handleMove(draggedCardId.current, status);
      draggedCardId.current = null;
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading board...</p>
      </div>
    );
  }

  return (
    <div className="kanban-page">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="dismiss-btn">
            Dismiss
          </button>
        </div>
      )}

      <div className="kanban-toolbar">
        <h2>Emergency Board</h2>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => fetchCards()}>
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateForm((v) => !v)}>
            {showCreateForm ? 'Cancel' : '+ New Card'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <form className="kanban-create-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Title (e.g. Flooding in sector 4)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={200}
            required
            autoFocus
          />
          <textarea
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
          />
          <div className="form-row">
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as KanbanPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="kanban-board">
        {COLUMNS.map(({ status, label }) => {
          const columnCards = cards.filter((c) => c.status === status);
          return (
            <div
              key={status}
              className={`kanban-column ${dragOverColumn === status ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumn(status);
              }}
              onDragLeave={() => setDragOverColumn((v) => (v === status ? null : v))}
              onDrop={onDrop(status)}
            >
              <div className="kanban-column-header">
                <span className={`column-dot column-${status}`} />
                <h3>{label}</h3>
                <span className="column-count">{columnCards.length}</span>
              </div>
              <div className="kanban-column-body">
                {columnCards.length === 0 ? (
                  <p className="column-empty">No cards</p>
                ) : (
                  columnCards.map((card) => (
                    <div
                      key={card.id}
                      className={`kanban-card priority-${card.priority}`}
                      draggable
                      onDragStart={onDragStart(card.id)}
                    >
                      <div className="kanban-card-header">
                        <span className={`priority-badge priority-${card.priority}`}>
                          {card.priority}
                        </span>
                        <button
                          className="card-delete"
                          title="Delete card"
                          onClick={() => handleDelete(card.id)}
                        >
                          ×
                        </button>
                      </div>
                      <p className="kanban-card-title">{card.title}</p>
                      {card.description && (
                        <p className="kanban-card-description">{card.description}</p>
                      )}
                      <div className="kanban-card-footer">
                        <span className={`source-badge source-${card.created_by}`}>
                          {card.created_by === 'agent' ? `agent · ${card.source}` : card.source}
                        </span>
                        <span className="card-time" title={card.created_at}>
                          {formatTimeAgo(card.created_at)}
                        </span>
                      </div>
                      {card.reporter && <p className="card-reporter">via {card.reporter}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
