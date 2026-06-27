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

  const currMsg = watch('msg');

  const { mutate: createChatSession, isPending: isCreatingChatSession } = useCreateChatSession();

  const {
    data: history,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useReadChatHistory(sessionId);

  const { mutate: sendChatMessage, isPending: isSendingChatMessage } =
    useSendChatMessage(sessionId);

  useEffect(() => {
    if (sessionId || isCreatingChatSession) return;
    createChatSession(taskId, {
      onSuccess: (data) => {
        setSessionId(data.session_id);
      },
    });
  }, [createChatSession, isCreatingChatSession, sessionId, taskId]);

  const visibleMessages = useMemo(() => {
    const flattened = history?.pages.flatMap((page) => page || []) ?? [];
    const filtered = flattened.filter(
      (message: ChatMessage) => message.role === 'USER' || message.role === 'ASSISTANT',
    );
    return [...filtered];
  }, [history]);

  const onSubmit = (data: SendChatMessage) => {
    const message = data.msg.trim();
    if (!message || !sessionId || isSendingChatMessage) return;

    sendChatMessage(
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

  const isInputDisabled = !sessionId || isSendingChatMessage;
  const isSendDisabled = !currMsg?.trim() || isInputDisabled;

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
