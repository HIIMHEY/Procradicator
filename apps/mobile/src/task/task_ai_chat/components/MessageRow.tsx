import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { ChatMessage } from '../schemas';
import { GeneratedCard } from './GeneratedCard';

interface MessageRowProps {
  message: ChatMessage;
  taskId?: string;
}

export function MessageRow({ message, taskId }: MessageRowProps) {
  if (message.role == 'TOOL') {
    return <GeneratedCard message={message.content} taskId={taskId} />;
  }
  const isUser = message.role === 'USER';
  return (
    <Box className={`mb-3 w-full flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      <Box
        aria-label={isUser ? 'Your message' : 'AI message'}
        className={`max-w-[78%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-primary' : 'bg-surface-container-highest'
        }`}
      >
        <Text
          className={`text-[15px] leading-5 ${isUser ? 'text-on-primary' : 'text-on-background'}`}
        >
          {message.content}
        </Text>
      </Box>
    </Box>
  );
}
