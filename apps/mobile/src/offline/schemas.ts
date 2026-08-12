import { userReadSchema } from '@/auth/schemas';
import {
  CreateFocusSessionSchema,
  FocusSessionResponseSchema,
  ReplaceFocusPayloadSchema,
  StateSchema,
  SyncPositionSchema,
  UpdateFocusPayloadSchema,
} from '@/focus_session/schemas';
import { TaskSchema, TaskWritePayloadSchema } from '@/task/schema';
import { z } from 'zod';

export const SyncStatusSchema = z.enum(['synced', 'pending', 'conflict']);

export const LocalTaskRecordSchema = z.object({
  key: z.string(),
  userId: z.string(),
  task: TaskSchema,
  syncStatus: SyncStatusSchema,
  deleted: z.boolean(),
});

export const TaskConflictRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  entityId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  localTask: TaskSchema.nullable(),
  serverTask: TaskSchema.nullable(),
  baseVersion: z.number().int().nonnegative().nullable(),
  createdAt: z.iso.datetime({ local: true }),
});

export const LocalFocusSessionRecordSchema = z.object({
  key: z.string(),
  userId: z.string(),
  taskId: z.string(),
  subtaskId: z.string(),
  session: FocusSessionResponseSchema,
  state: StateSchema,
  queued: SyncPositionSchema,
  syncStatus: SyncStatusSchema,
  terminal: z.boolean(),
});

export const FocusConflictRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  entityId: z.string(),
  localSession: LocalFocusSessionRecordSchema,
  serverSession: FocusSessionResponseSchema,
  baseVersion: z.number().int().nonnegative().nullable(),
  createdAt: z.iso.datetime({ local: true }),
});

export const ActiveSessionSchema = z.object({
  key: z.string(),
  apiOrigin: z.string(),
  state: z.literal('authenticated'),
  user: userReadSchema,
  remainingMsAtValidation: z.number().nonnegative(),
  validatedAtClientMs: z.number().nonnegative(),
});

export const LogoutSessionSchema = z.object({
  key: z.string(),
  apiOrigin: z.string(),
  state: z.literal('logged_out'),
  previousUserId: z.string(),
  logoutId: z.string(),
  requestedAtClientMs: z.number().nonnegative(),
  remoteLogout: z.enum(['pending', 'acknowledged']),
});

export const AuthSessionSchema = z.discriminatedUnion('state', [
  ActiveSessionSchema,
  LogoutSessionSchema,
]);

const outboxShape = {
  id: z.string(),
  userId: z.string(),
  entityId: z.string(),
  baseVersion: z.number().int().nonnegative().nullable(),
  createdAt: z.iso.datetime({ local: true }),
};

const taskOutboxShape = { ...outboxShape, entityType: z.literal('task') };
export const TaskOutboxRecordSchema = z.discriminatedUnion('operation', [
  z.object({ ...taskOutboxShape, operation: z.literal('create'), payload: TaskWritePayloadSchema }),
  z.object({ ...taskOutboxShape, operation: z.literal('update'), payload: TaskWritePayloadSchema }),
  z.object({ ...taskOutboxShape, operation: z.literal('delete'), payload: z.null() }),
]);

const focusOutboxShape = { ...outboxShape, entityType: z.literal('focusSession') };
export const FocusOutboxRecordSchema = z.discriminatedUnion('operation', [
  z.object({
    ...focusOutboxShape,
    operation: z.literal('focus-create'),
    payload: CreateFocusSessionSchema,
  }),
  z.object({
    ...focusOutboxShape,
    operation: z.literal('focus-update'),
    payload: UpdateFocusPayloadSchema,
  }),
  z.object({
    ...focusOutboxShape,
    operation: z.literal('focus-replace'),
    payload: ReplaceFocusPayloadSchema,
  }),
]);

export const AuthOutboxRecordSchema = z.object({
  ...outboxShape,
  entityType: z.literal('auth'),
  operation: z.literal('logout'),
  payload: z.null(),
});

export const OutboxRecordSchema = z.discriminatedUnion('entityType', [
  TaskOutboxRecordSchema,
  FocusOutboxRecordSchema,
  AuthOutboxRecordSchema,
]);

export const ConflictRecordSchema = z.union([TaskConflictRecordSchema, FocusConflictRecordSchema]);

export type LocalTaskRecord = z.infer<typeof LocalTaskRecordSchema>;
export type TaskConflictRecord = z.infer<typeof TaskConflictRecordSchema>;
export type LocalFocusSessionRecord = z.infer<typeof LocalFocusSessionRecordSchema>;
export type FocusConflictRecord = z.infer<typeof FocusConflictRecordSchema>;
export type ActiveSession = z.infer<typeof ActiveSessionSchema>;
export type LogoutSession = z.infer<typeof LogoutSessionSchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type TaskOutboxRecord = z.infer<typeof TaskOutboxRecordSchema>;
export type FocusOutboxRecord = z.infer<typeof FocusOutboxRecordSchema>;
export type AuthOutboxRecord = z.infer<typeof AuthOutboxRecordSchema>;
export type OutboxRecord = z.infer<typeof OutboxRecordSchema>;
