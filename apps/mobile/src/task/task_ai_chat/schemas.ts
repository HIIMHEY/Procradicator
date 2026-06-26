import { z } from 'zod';

export const ChatRoleSchema = z.enum(['SYSTEM', 'ASSISTANT', 'TOOL', 'USER']);

export const ChatSessionResponseSchema = z.object({
  session_id: z.uuid(),
});

export const ChatMessageSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  role: ChatRoleSchema,
  content: z.string(),
  created_at: z.iso.datetime(),
  tool_call_id: z.string().nullable(),
});

export const ChatHistorySchema = z.array(ChatMessageSchema);

export type ChatRole = z.infer<typeof ChatRoleSchema>;
export type ChatSessionResponse = z.infer<typeof ChatSessionResponseSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
