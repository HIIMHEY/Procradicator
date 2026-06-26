import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Eye, Pencil, Send } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import useCreateChatSession from '../hooks/useCreateChatSession';
import useReadChatHistory from '../hooks/useReadChatHistory';
import useSendChatMessage from '../hooks/useSendChatMessage';
import type { ChatMessage } from '../schemas';

const PURPLE = '#6D2DE2';
const BORDER = '#E5E5E5';

export function AiTaskChatPage() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams();
  const taskId = Array.isArray(rawId) ? rawId[0] : rawId || '';
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const { mutate: createChatSession, isPending: isCreatingChatSession } = useCreateChatSession();
  const { data: history = [] } = useReadChatHistory(sessionId);
  const { mutate: sendChatMessage, isPending: isSendingChatMessage } = useSendChatMessage(
    sessionId,
    taskId,
  );
  useEffect(() => {
    if (!taskId || sessionId || isCreatingChatSession) return;
    createChatSession(taskId, {
      onSuccess: (data) => {
        setSessionId(data.session_id);
      },
    });
  }, [createChatSession, isCreatingChatSession, sessionId, taskId]);
  const visibleMessages = useMemo(
    () => history.filter((message) => message.role === 'USER' || message.role === 'ASSISTANT'),
    [history],
  );
  const handleSend = () => {
    const message = draft.trim();
    if (!message || !sessionId || isSendingChatMessage) return;
    sendChatMessage(
      { message },
      {
        onSuccess: () => {
          setDraft('');
        },
      },
    );
  };
  const goManual = () => {
    router.navigate(`/tasks/${taskId}/edit`);
  };
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Box className="flex-1 bg-white px-8 pb-6 pt-8">
        <Box className="flex-row items-start justify-between">
          <Button
            onPress={() => router.back()}
            variant="link"
            className="h-14 w-14 items-center justify-center rounded-full p-0"
          >
            <Icon as={ArrowLeft} size="xl" color="black" />
          </Button>

          <Button
            onPress={goManual}
            className="flex-row items-center gap-1.5 rounded-full px-4 py-3"
            style={{ backgroundColor: PURPLE }}
          >
            <Icon as={Pencil} size="xs" color="white" />
            <ButtonText className="text-xs font-medium text-white">Manual Mode</ButtonText>
          </Button>
        </Box>

        <ScrollView
          className="flex-1"
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {visibleMessages.map((message) => (
            <MessageRow key={message.id} message={message} taskId={taskId} />
          ))}
        </ScrollView>

        <Box className="flex-row items-center gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="User Chat Message Input field"
            placeholderTextColor="#666666"
            className="h-11 flex-1 rounded-full border px-4 text-sm text-zinc-700"
            style={{ borderColor: BORDER }}
            editable={!!sessionId && !isSendingChatMessage}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />

          <Button
            onPress={handleSend}
            isDisabled={!draft.trim() || !sessionId || isSendingChatMessage}
            className="h-11 w-11 items-center justify-center rounded-full p-0"
            style={{ backgroundColor: PURPLE }}
          >
            <Icon as={Send} size="md" color="white" />
          </Button>
        </Box>
      </Box>
    </KeyboardAvoidingView>
  );
}

interface MessageRowProps {
  message: ChatMessage;
  taskId: string;
}

function MessageRow({ message, taskId }: MessageRowProps) {
  if (message.role === 'USER') {
    return (
      <Box className="mb-6 w-full flex-row justify-end">
        <Box
          className="max-w-[48%] rounded-full border bg-white px-4 py-2"
          style={{ borderColor: BORDER }}
        >
          <Text className="text-sm text-zinc-600">{message.content}</Text>
        </Box>
      </Box>
    );
  }
  if (message.content.startsWith('Task:')) {
    return <ToolCallCard taskId={taskId} />;
  }
  return (
    <Box className="mb-6 w-full flex-row justify-start">
      <Box
        className="max-w-[48%] rounded-full border bg-white px-4 py-2"
        style={{ borderColor: BORDER }}
      >
        <Text className="text-sm text-zinc-600">{message.content}</Text>
      </Box>
    </Box>
  );
}

interface ToolCallCardProps {
  taskId: string;
}

function ToolCallCard({ taskId }: ToolCallCardProps) {
  const router = useRouter();
  const viewTask = () => {
    router.navigate(`/tasks/${taskId}`);
  };
  return (
    <Box className="mb-6 w-full flex-row justify-start">
      <Box
        className="w-[150px] rounded-[24px] border bg-white px-4 pb-4 pt-6"
        style={{ borderColor: BORDER }}
      >
        <Text className="mb-10 text-sm leading-5 text-zinc-700">AI Tool Call{'\n'}Message</Text>

        <Button
          onPress={viewTask}
          variant="outline"
          className="h-10 flex-row items-center justify-center gap-1 rounded-lg border px-3"
          style={{ borderColor: PURPLE }}
        >
          <Icon as={Eye} size="sm" color={PURPLE} />
          <ButtonText className="text-sm font-medium" style={{ color: PURPLE }}>
            View Task
          </ButtonText>
        </Button>
      </Box>
    </Box>
  );
}

const styles = StyleSheet.create({
  chatContent: {
    paddingTop: 64,
    paddingBottom: 24,
  },
});
