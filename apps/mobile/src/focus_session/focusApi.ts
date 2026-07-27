import { API_ROUTES } from '@/config/env';
import type { FocusOutboxPayload, OutboxRecord } from '@/offline/databaseTypes';
import {
  FocusSessionResponseSchema,
  type FocusSessionResponse,
  type UpdateFocusPayload,
} from './schemas';

export class FocusRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Focus session request failed with status ${status}`);
  }
}

export class FocusConflictError extends FocusRequestError {
  constructor(public readonly serverSession: FocusSessionResponse) {
    super(412);
  }
}

function focusPayload(operation: OutboxRecord): FocusOutboxPayload {
  if (!operation.payload || typeof operation.payload !== 'object') {
    throw new Error('Focus operation payload is missing');
  }
  return operation.payload as FocusOutboxPayload;
}

function operationHeaders(operation: OutboxRecord): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': operation.id,
  };
  if (operation.baseVersion !== null) {
    headers['If-Match'] = `"${operation.baseVersion}"`;
  }
  return headers;
}

export async function sendFocusOp(operation: OutboxRecord): Promise<FocusSessionResponse> {
  if (operation.entityType !== 'focusSession') {
    throw new Error('Expected a focus session operation');
  }
  const headers = operationHeaders(operation);
  let response: Response;
  if (operation.operation === 'focus-create') {
    response = await fetch(API_ROUTES.FOCUS.BASE, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(focusPayload(operation)),
    });
  } else if (operation.operation === 'focus-update') {
    response = await fetch(API_ROUTES.FOCUS.DETAIL(operation.entityId), {
      method: 'PATCH',
      headers,
      credentials: 'include',
      body: JSON.stringify(focusPayload(operation) as UpdateFocusPayload),
    });
  } else {
    throw new Error(`Unsupported focus operation: ${operation.operation}`);
  }

  if (response.status === 412) {
    const body = (await response.json()) as { server?: unknown };
    throw new FocusConflictError(FocusSessionResponseSchema.parse(body.server));
  }
  if (!response.ok) throw new FocusRequestError(response.status);
  return FocusSessionResponseSchema.parse(await response.json());
}

export async function readServerFocusSession(
  sessionId: string,
): Promise<FocusSessionResponse | null> {
  const response = await fetch(API_ROUTES.FOCUS.DETAIL(sessionId), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new FocusRequestError(response.status);
  return FocusSessionResponseSchema.parse(await response.json());
}
