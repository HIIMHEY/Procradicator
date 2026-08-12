import { z } from 'zod';

export const ChatRoleEnum = z.enum(['SYSTEM', 'ASSISTANT', 'TOOL', 'USER']);

export const ChatSessionResponseSchema = z.object({
  session_id: z.uuid(),
});

export const ChatMessageSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  role: ChatRoleEnum,
  content: z.string(),
  created_at: z.iso.datetime(),
  tool_call_id: z.string().nullish(),
});

export const SendChatMessageSchema = z.object({
  msg: z.string(),
});

export type ChatSessionResponse = z.infer<typeof ChatSessionResponseSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type SendChatMessage = z.infer<typeof SendChatMessageSchema>;
