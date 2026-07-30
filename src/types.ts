import type { Sandbox } from '@cloudflare/sandbox';

/**
 * Environment bindings for the OpenClaw Worker
 */
export interface OpenClawEnv {
  Sandbox: DurableObjectNamespace<Sandbox>;
  ASSETS: Fetcher; // Assets binding for admin UI static files
  BACKUP_BUCKET: R2Bucket; // R2 bucket for Sandbox SDK backup/restore
  // Cloudflare AI Gateway configuration (preferred)
  CF_AI_GATEWAY_ACCOUNT_ID?: string; // Cloudflare account ID for AI Gateway
  CF_AI_GATEWAY_GATEWAY_ID?: string; // AI Gateway ID
  CLOUDFLARE_AI_GATEWAY_API_KEY?: string; // API key for requests through the gateway
  CF_AI_GATEWAY_MODEL?: string; // Override model: "provider/model-id" e.g. "workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"
  // Legacy AI Gateway configuration (still supported for backward compat)
  AI_GATEWAY_API_KEY?: string; // API key for the provider configured in AI Gateway
  AI_GATEWAY_BASE_URL?: string; // AI Gateway URL (e.g., https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic)
  // Direct provider configuration
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  MOLTBOT_GATEWAY_TOKEN?: string; // Gateway token (mapped to OPENCLAW_GATEWAY_TOKEN for container)
  DEV_MODE?: string; // Set to 'true' for local dev (skips CF Access auth + openclaw device pairing)
  E2E_TEST_MODE?: string; // Set to 'true' for E2E tests (skips CF Access auth but keeps device pairing)
  DEBUG_ROUTES?: string; // Set to 'true' to enable /debug/* routes
  SANDBOX_SLEEP_AFTER?: string; // How long before sandbox sleeps: 'never' (default), or duration like '10m', '1h'
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_DM_POLICY?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_DM_POLICY?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_APP_TOKEN?: string;
  // Cloudflare Access configuration for admin routes
  CF_ACCESS_TEAM_DOMAIN?: string; // e.g., 'myteam.cloudflareaccess.com'
  CF_ACCESS_AUD?: string; // Application Audience (AUD) tag
  // R2 credentials for Sandbox SDK backup/restore (set via wrangler secret)
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string; // Cloudflare account ID for R2 presigned URLs
  BACKUP_BUCKET_NAME?: string; // R2 bucket name for backup storage
  // Browser Rendering binding for CDP shim
  BROWSER?: Fetcher;
  CDP_SECRET?: string; // Shared secret for CDP endpoint authentication
  WORKER_URL?: string; // Public URL of the worker (for CDP endpoint)

  // Cron wake-ahead: wake container before OpenClaw cron jobs fire
  CRON_WAKE_AHEAD_MINUTES?: string; // Minutes before a cron job to wake the container (default: 10)

  // Emergency kanban board
  KANBAN_DB?: D1Database; // D1 database with kanban cards (see migrations/)
  KANBAN_AGENT_SECRET?: string; // Shared secret for /api/internal/kanban (agent access; also passed to container)
}

/**
 * Kanban card status / priority / origin enums
 */
export const KANBAN_STATUSES = ['new', 'triaged', 'in_progress', 'resolved'] as const;
export type KanbanStatus = (typeof KANBAN_STATUSES)[number];

export const KANBAN_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type KanbanPriority = (typeof KANBAN_PRIORITIES)[number];

export const KANBAN_CARD_TYPES = ['need', 'offer'] as const;
export type KanbanCardType = (typeof KANBAN_CARD_TYPES)[number];

/**
 * A kanban card as stored in D1
 */
export interface KanbanCard {
  id: string;
  case_num: number;
  type: KanbanCardType;
  title: string;
  description: string;
  status: KanbanStatus;
  priority: KanbanPriority;
  source: string; // e.g. 'manual', 'web', 'telegram', 'whatsapp'
  reporter: string | null; // who reported it (email, telegram user, phone...)
  created_by: 'human' | 'agent';
  created_at: string; // ISO datetime (UTC)
  updated_at: string;
}

/**
 * Authenticated user from Cloudflare Access
 */
export interface AccessUser {
  email: string;
  name?: string;
}

/**
 * Hono app environment type
 */
export type AppEnv = {
  Bindings: OpenClawEnv;
  Variables: {
    sandbox: Sandbox;
    accessUser?: AccessUser;
  };
};

/**
 * JWT payload from Cloudflare Access
 */
export interface JWTPayload {
  aud: string[];
  email: string;
  exp: number;
  iat: number;
  iss: string;
  name?: string;
  sub: string;
  type: string;
}
