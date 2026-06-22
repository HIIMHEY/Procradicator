import * as z from 'zod';

export const SubtaskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().optional(),
  next_subtask: z.array(z.uuid()),
  is_done: z.boolean(),
});

export const TaskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().optional(),
  subtasks: z.array(SubtaskSchema),
});

export const ModifySubtaskSchema = z.object({
  id: z.string(), //no msg as handled by form
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(100, 'Title too long, try splitting into smaller subtasks'),
  description: z
    .string()
    .trim()
    .max(500, 'Description too long, try splitting up the suptask')
    .optional(),
  estimate: z.coerce
    .number('Must be a number!')
    .int('Must be a whole number! 1,2,3...')
    .positive('Time must be positive!'),
  is_done: z.boolean(),
  depends_on: z.array(z.string()),
});

export const ModifyTaskSchema = z.object({
  id: z.uuid().optional(), //only present for edits
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().trim().max(500, 'Description too long').optional(),
  subtasks: z.array(ModifySubtaskSchema).min(1, "Must have at least 1 subtask!"),
});

export const TaskModifyModeEnum = z.enum(['Create', 'Edit']);

export type TaskModifyMode = z.infer<typeof TaskModifyModeEnum>;
export type Task = z.infer<typeof TaskSchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type ModifySubtaskData = z.infer<typeof ModifySubtaskSchema>;
export type ModifyTaskData = z.infer<typeof ModifyTaskSchema>;
