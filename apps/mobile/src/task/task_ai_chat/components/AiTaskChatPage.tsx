import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Send } from 'lucide-react-native';
import { ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Controller } from 'react-hook-form';
import { MessageRow } from './MessageRow';
import { NavigationBar } from '@/task/components/NavigationBar';
import { ManualButton } from './ManualButton';
import { FlatList } from 'react-native-gesture-handler';
import { useAiTaskChat } from '../hooks/useAIChat';
import { Input, InputField } from '@/components/ui/input';

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

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <NavigationBar
        backurl={taskId ? `/tasks/${taskId}/edit` : '/tasks'}
        renderRightAction={() => <ManualButton taskId={taskId} />}
      />

      <FlatList
        inverted
        data={visibleMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageRow message={item} taskId={taskId} />}
        className="flex-1 px-4"
        contentContainerClassName="py-4"
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        ListHeaderComponent={
          isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#6D2DE2" className="my-4" />
          ) : null
        }
      />

      <Box className="flex-row items-center gap-2 border-t border-zinc-100 bg-white px-4 pt-3 pb-6">
        <Controller
          control={control}
          name="msg"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              isDisabled={isInputDisabled}
              className="h-11 flex-1 rounded-full border border-zinc-200 bg-zinc-50"
            >
              <InputField
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="State your goals..."
                placeholderTextColor="#A1A1AA"
                className="px-4 text-sm text-zinc-800"
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
            </Input>
          )}
        />

        <Button
          onPress={handleSend}
          isDisabled={isSendDisabled}
          className="h-10 w-10 items-center justify-center rounded-full p-0 bg-[#6D2DE2]"
        >
          <Icon as={Send} size="sm" color="white" />
        </Button>
      </Box>
    </KeyboardAvoidingView>
  );
}
