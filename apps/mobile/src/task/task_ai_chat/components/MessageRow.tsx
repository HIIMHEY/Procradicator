import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { ChatMessage } from '../schemas';
import { GeneratedCard } from './GeneratedCard';
import dayjs from 'dayjs';

interface MessageRowProps {
  message: ChatMessage;
  taskId: string;
}

export function MessageRow({ message, taskId }: MessageRowProps) {
  if (message.role == 'TOOL') {
    return <GeneratedCard message={message.content} taskId={taskId} />;
  }

  const isUser = message.role === 'USER';

  const formattedTime = dayjs().format('HH:mm');

  return (
    <Box className={`mb-3 w-full flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      <Box className={`max-w-[78%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <Box className={`px-4 py-2.5 rounded-2xl border`}>
          <Text className={`text-[15px] leading-5 text-zinc-800}`}>{message.content}</Text>
        </Box>

        {formattedTime ? (
          <Text className="mt-1 px-1 text-[11px] font-medium text-zinc-400">{formattedTime}</Text>
        ) : null}
      </Box>
    </Box>
  );
}
