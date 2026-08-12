import { Button, ButtonIcon } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Toast, ToastTitle, useToast } from '@/components/ui/toast';
import { useSendFriendRequest } from '@/friends/hooks/useFriendActions';
import { useFriendRequests, useFriendSearch, useFriends } from '@/friends/hooks/useFriendQueries';
import { Search, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { FriendEmpty, FriendError, FriendLoading } from './FriendState';

interface FriendSearchProps {
  userId: string;
}

export function FriendSearch({ userId }: FriendSearchProps) {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const friendsQuery = useFriends(userId);
  const requestsQuery = useFriendRequests(userId);
  const search = useFriendSearch(userId, username);
  const send = useSendFriendRequest();
  const friends = friendsQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const sendRequest = async (name: string) => {
    try {
      await send.mutateAsync(name);
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="success" variant="solid">
            <ToastTitle>Request sent</ToastTitle>
          </Toast>
        ),
      });
    } catch {
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="error" variant="solid">
            <ToastTitle>Request failed</ToastTitle>
          </Toast>
        ),
      });
    }
  };
  if (friendsQuery.isPending || requestsQuery.isPending) {
    return <FriendLoading label="Add friends loading" />;
  }
  if (friendsQuery.isError || requestsQuery.isError) {
    return (
      <FriendError
        label="Add friends error state"
        retryLabel="Retry add friends"
        onRetry={() => {
          void Promise.all([friendsQuery.refetch(), requestsQuery.refetch()]);
        }}
      />
    );
  }
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="px-5 pb-8"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="min-h-80 rounded-3xl bg-surface-container-low p-5">
        <Input size="xl" className="rounded-2xl border-0 bg-surface-container-lowest">
          <InputSlot className="pl-4">
            <InputIcon as={Search} className="text-on-surface-variant" />
          </InputSlot>
          <InputField
            accessibilityLabel="Search users"
            aria-label="Search users"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Find new people..."
            value={username}
            onChangeText={setUsername}
            className="text-base text-on-surface"
          />
        </Input>

        {!username.trim() ? (
          <View className="flex-1 items-center justify-center px-4 py-10">
            <Icon as={UserPlus} size="xl" className="text-primary" />
            <Text className="mt-5 text-center text-xl font-medium text-on-surface">
              It&apos;s more fun with friends!
            </Text>
            <Text className="mt-3 text-center text-base leading-6 text-on-surface-variant">
              Use the search bar above to find friends by username.
            </Text>
          </View>
        ) : search.isFetching ? (
          <View className="pt-5">
            <FriendLoading label="Search loading" />
          </View>
        ) : search.isError ? (
          <FriendError
            label="Search error state"
            retryLabel="Retry search"
            onRetry={() => void search.refetch()}
          />
        ) : (search.data ?? []).length === 0 ? (
          <FriendEmpty
            label="Search empty state"
            title="No users found"
            description="Check the username and try again."
          />
        ) : (
          <View className="gap-3 pt-5">
            {(search.data ?? []).map((user) => {
              const isFriend = friends.some((friend) => friend.user.id === user.id);
              const isSent = requests.some(
                (request) => !request.is_incoming && request.user.id === user.id,
              );
              return (
                <View
                  key={user.id}
                  accessibilityLabel={`Search result for ${user.username}`}
                  className="min-h-20 flex-row items-center rounded-xl bg-surface-container-lowest px-4 py-3"
                >
                  <Text className="flex-1 text-base text-on-surface">{user.username}</Text>
                  {isFriend || isSent ? (
                    <View className="rounded-xl bg-primary-container px-4 py-2">
                      <Text className="font-medium text-primary">
                        {isFriend ? 'Friends' : 'Sent'}
                      </Text>
                    </View>
                  ) : (
                    <Button
                      accessibilityLabel={`Add ${user.username}`}
                      size="sm"
                      isDisabled={send.isPending}
                      onPress={() => void sendRequest(user.username)}
                      className="h-11 w-12 rounded-xl bg-primary-container p-0"
                    >
                      <ButtonIcon as={UserPlus} className="text-primary" />
                    </Button>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
