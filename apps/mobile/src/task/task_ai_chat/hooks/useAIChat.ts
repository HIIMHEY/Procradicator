import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import useCreateChatSession from '../hooks/useCreateChatSession';
import useReadChatHistory from '../hooks/useReadChatHistory';
import useSendChatMessage from '../hooks/useSendChatMessage';
import { ChatMessage, SendChatMessage } from '../schemas';

export function useAiTaskChat() {
  const { id: rawId } = useLocalSearchParams();
  const taskId = Array.isArray(rawId) ? rawId[0] : rawId || '';
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { control, handleSubmit, reset, watch } = useForm<SendChatMessage>({
    defaultValues: { msg: '' },
  });

  const draft = watch('msg');

  const {
    mutate: createSession,
    isPending: creatingSession,
    isError: createFailed,
  } = useCreateChatSession();

  const {
    data: history,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useReadChatHistory(sessionId);

  const { mutate: sendMessage, isPending: sendingMessage } = useSendChatMessage(sessionId);

  useEffect(() => {
    if (sessionId || creatingSession || createFailed) return;
    createSession(taskId, {
      onSuccess: (data) => {
        setSessionId(data.session_id);
      },
    });
  }, [createFailed, createSession, creatingSession, sessionId, taskId]);

  const visibleMessages = useMemo(() => {
    const flattened = history?.pages.flatMap((page) => page || []) ?? [];
    const filtered = flattened.filter(
      (message: ChatMessage) =>
        message.role === 'USER' || message.role === 'ASSISTANT' || message.role === 'TOOL',
    );
    return filtered;
  }, [history]);

  const onSubmit = (data: SendChatMessage) => {
    const message = data.msg.trim();
    if (!message || !sessionId || sendingMessage) return;
    sendMessage(
      { message },
      {
        onSuccess: () => {
          reset({ msg: '' });
        },
      },
    );
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const isInputDisabled = !sessionId || sendingMessage;
  const isSendDisabled = !draft?.trim() || isInputDisabled;

  return {
    taskId,
    control,
    visibleMessages,
    isFetchingNextPage,
    isInputDisabled,
    isSendDisabled,
    handleLoadMore,
    handleSend: handleSubmit(onSubmit),
  };
}
