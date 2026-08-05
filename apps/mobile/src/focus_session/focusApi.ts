import { API_ROUTES } from '@/config/env';
import {
  CreateFocusSessionSchema,
  FocusSessionResponseSchema,
  ReplaceFocusPayloadSchema,
  UpdateFocusPayloadSchema,
  type FocusSessionResponse,
} from './schemas';

export interface FocusRequest {
  opId: string;
  sessionId: string;
  operation: 'focus-create' | 'focus-update' | 'focus-replace';
  payload: unknown;
  baseVersion: number | null;
}

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

function focusPayload(request: FocusRequest) {
  if (request.operation === 'focus-create') return CreateFocusSessionSchema.parse(request.payload);
  if (request.operation === 'focus-update') return UpdateFocusPayloadSchema.parse(request.payload);
  return ReplaceFocusPayloadSchema.parse(request.payload);
}

function operationHeaders(request: FocusRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': request.opId,
  };
  if (request.baseVersion !== null) {
    headers['If-Match'] = `"${request.baseVersion}"`;
  }
  return headers;
}

export async function sendFocusOp(request: FocusRequest): Promise<FocusSessionResponse> {
  const headers = operationHeaders(request);
  let response: Response;
  if (request.operation === 'focus-create') {
    response = await fetch(API_ROUTES.FOCUS.BASE, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(focusPayload(request)),
    });
  } else if (request.operation === 'focus-update' || request.operation === 'focus-replace') {
    response = await fetch(API_ROUTES.FOCUS.DETAIL(request.sessionId), {
      method: request.operation === 'focus-replace' ? 'PUT' : 'PATCH',
      headers,
      credentials: 'include',
      body: JSON.stringify(focusPayload(request)),
    });
  } else {
    throw new Error(`Unsupported focus operation: ${request.operation}`);
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
