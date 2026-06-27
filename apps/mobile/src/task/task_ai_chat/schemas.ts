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

export const ChatHistorySchema = z.array(ChatMessageSchema);

export type ChatRole = z.infer<typeof ChatRoleEnum>;
export type ChatSessionResponse = z.infer<typeof ChatSessionResponseSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type UIChatMessage = z.infer<typeof ChatMessageSchema> ;
export type SendChatMessage = z.infer<typeof SendChatMessageSchema>;
