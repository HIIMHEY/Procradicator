import { z } from 'zod';

export const FriendUserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
});

export const FriendLinkSchema = z.object({
  id: z.uuid(),
  user: FriendUserSchema,
  requested_at: z.iso.datetime({ offset: true }),
  accepted_at: z.iso.datetime({ offset: true }).nullable(),
  is_incoming: z.boolean(),
});

export const FriendProgressSchema = z.object({
  user: FriendUserSchema,
  focus_min: z.number().int().nonnegative(),
  completed_subtasks: z.number().int().nonnegative(),
});

export const FriendRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Username is required.')
    .max(100, 'Username must be at most 100 characters.'),
});

export const NudgeSchema = z.object({
  id: z.uuid(),
  sender: FriendUserSchema,
  sent_at: z.iso.datetime({ offset: true }),
});

export const FriendIdSchema = z.object({
  friendship_id: z.uuid(),
});

export const NudgeIdSchema = z.object({
  nudge_id: z.uuid(),
});

export type FriendUser = z.infer<typeof FriendUserSchema>;
export type FriendLink = z.infer<typeof FriendLinkSchema>;
export type FriendProgress = z.infer<typeof FriendProgressSchema>;
export type FriendRequest = z.infer<typeof FriendRequestSchema>;
export type Nudge = z.infer<typeof NudgeSchema>;
export type FriendId = z.infer<typeof FriendIdSchema>;
export type NudgeId = z.infer<typeof NudgeIdSchema>;
