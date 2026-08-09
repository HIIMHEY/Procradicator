import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { type Href } from 'expo-router';
import { Send } from 'lucide-react-native';
import { Controller } from 'react-hook-form';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { TaskHeader } from '@/task/components/TaskHeader';
import { useAiTaskChat } from '../hooks/useAIChat';
import { MessageRow } from './MessageRow';

export function AiTaskChatPage() {
  const {
    taskId,
    control,
    visibleMessages,
    isFetchingNextPage,
    isInputDisabled,
    isSendDisabled,
    handleLoadMore,
    handleSend,
  } = useAiTaskChat();
  const closeHref: Href = taskId ? `/tasks/${taskId}/edit` : '/tasks';
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Box className="w-full max-w-[390px] flex-1 self-center bg-background md:max-w-none">
        <TaskHeader taskId={taskId || undefined} active="ai" backHref={closeHref} />

        <FlatList
          inverted
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageRow message={item} taskId={taskId} />}
          className="mt-3 flex-1 px-margin-mobile"
          contentContainerClassName="py-4"
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={
            isFetchingNextPage ? (
              <Spinner
                accessibilityLabel="Loading earlier messages"
                className="my-4 text-primary"
              />
            ) : null
          }
        />

        <Box className="bg-background px-margin-mobile pb-6 pt-2">
          <Box className="h-12 flex-row items-center rounded-full border border-outline bg-surface-container-highest p-1">
            <Controller
              control={control}
              name="msg"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  isDisabled={isInputDisabled}
                  className="h-10 flex-1 border-0 bg-transparent data-[focus=true]:web:ring-0"
                >
                  <InputField
                    accessibilityLabel="Chat message"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="State your goals..."
                    className="px-4 text-sm text-on-background placeholder:text-outline"
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                  />
                </Input>
              )}
            />

            <Button
              accessibilityLabel="Send message"
              onPress={handleSend}
              isDisabled={isSendDisabled}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary p-0"
            >
              <Icon as={Send} className="text-on-primary" size="lg" />
            </Button>
          </Box>
        </Box>
      </Box>
    </KeyboardAvoidingView>
  );
}
