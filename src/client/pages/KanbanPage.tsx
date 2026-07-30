import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listKanbanCards,
  createKanbanCard,
  updateKanbanCard,
  deleteKanbanCard,
  AuthError,
  KANBAN_CARD_TYPES,
  type KanbanCard,
  type KanbanCardType,
  type KanbanPriority,
  type KanbanStatus,
} from '../api';
import { useI18n, type TFunction } from '../i18n';
import './KanbanPage.css';

const COLUMNS: KanbanStatus[] = ['new', 'triaged', 'in_progress', 'resolved'];

const PRIORITIES: KanbanPriority[] = ['critical', 'high', 'medium', 'low'];

const REFRESH_INTERVAL_MS = 15000;

function formatTimeAgo(iso: string, t: TFunction) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t('time.secondsAgo', { n: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  return t('time.daysAgo', { n: days });
}

export default function KanbanPage() {
  const { t } = useI18n();
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<KanbanCardType>('need');
  const [newPriority, setNewPriority] = useState<KanbanPriority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const draggedCardId = useRef<string | null>(null);

  const fetchCards = useCallback(
    async (showSpinner = false) => {
      try {
        if (showSpinner) setLoading(true);
        setError(null);
        const data = await listKanbanCards();
        setCards(data.cards || []);
      } catch (err) {
        if (err instanceof AuthError) {
          setError(t('common.authRequired'));
        } else {
          setError(err instanceof Error ? err.message : t('kb.fetchFailed'));
        }
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

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
        type: newType,
        priority: newPriority,
      });
      setNewTitle('');
      setNewDescription('');
      setNewType('need');
      setNewPriority('medium');
      setShowCreateForm(false);
      await fetchCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('kb.createFailed'));
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
      setError(err instanceof Error ? err.message : t('kb.moveFailed'));
      await fetchCards();
    }
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm(t('kb.deleteConfirm'))) return;
    try {
      await deleteKanbanCard(cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('kb.deleteFailed'));
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
        <p>{t('kb.loadingBoard')}</p>
      </div>
    );
  }

  return (
    <div className="kanban-page">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="dismiss-btn">
            {t('common.dismiss')}
          </button>
        </div>
      )}

      <div className="kanban-toolbar">
        <h2>{t('kb.board')}</h2>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => fetchCards()}>
            {t('common.refresh')}
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateForm((v) => !v)}>
            {showCreateForm ? t('kb.cancel') : t('kb.newCard')}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <form className="kanban-create-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder={t('kb.titlePlaceholder')}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={200}
            required
            autoFocus
          />
          <textarea
            placeholder={t('kb.descPlaceholder')}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
          />
          <div className="form-row">
            <select value={newType} onChange={(e) => setNewType(e.target.value as KanbanCardType)}>
              {KANBAN_CARD_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {t(`kb.type.${ct}`)}
                </option>
              ))}
            </select>
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
              {submitting ? t('kb.creating') : t('kb.create')}
            </button>
          </div>
        </form>
      )}

      <div className="kanban-board">
        {COLUMNS.map((status) => {
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
                <h3>{t(`kb.col.${status}`)}</h3>
                <span className="column-count">{columnCards.length}</span>
              </div>
              <div className="kanban-column-body">
                {columnCards.length === 0 ? (
                  <p className="column-empty">{t('kb.noCards')}</p>
                ) : (
                  columnCards.map((card) => (
                    <div
                      key={card.id}
                      className={`kanban-card priority-${card.priority}`}
                      draggable
                      onDragStart={onDragStart(card.id)}
                    >
                      <div className="kanban-card-header">
                        <span className="case-num">{t('kb.case', { n: card.case_num })}</span>
                        <span className={`type-badge type-${card.type}`}>
                          {t(`kb.type.${card.type}`)}
                        </span>
                        <span className={`priority-badge priority-${card.priority}`}>
                          {card.priority}
                        </span>
                        <button
                          className="card-delete"
                          title={t('kb.deleteConfirm')}
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
                          {card.created_by === 'agent'
                            ? t('kb.agentSource', { source: card.source })
                            : card.source}
                        </span>
                        <span className="card-time" title={card.created_at}>
                          {formatTimeAgo(card.created_at, t)}
                        </span>
                      </div>
                      {card.reporter && (
                        <p className="card-reporter">{t('kb.via', { reporter: card.reporter })}</p>
                      )}
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
