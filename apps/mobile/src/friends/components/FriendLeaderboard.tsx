import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Toast, ToastTitle, useToast } from '@/components/ui/toast';
import { useRemoveFriend, useSendNudge } from '@/friends/hooks/useFriendActions';
import { useFriendProgress, useFriends } from '@/friends/hooks/useFriendQueries';
import { Clock3, Hand, ListChecks, MoreHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { FriendEmpty, FriendError, FriendLoading } from './FriendState';

interface FriendLeaderboardProps {
  userId: string;
}

export function FriendLeaderboard({ userId }: FriendLeaderboardProps) {
  const toast = useToast();
  const [menuId, setMenuId] = useState<string>();
  const friendsQuery = useFriends(userId);
  const progressQuery = useFriendProgress(userId);
  const remove = useRemoveFriend();
  const nudge = useSendNudge();
  const friends = friendsQuery.data ?? [];
  const progress = progressQuery.data ?? [];
  const nudgeFriend = async (id: string) => {
    try {
      await nudge.mutateAsync(id);
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="success" variant="solid">
            <ToastTitle>Nudge sent</ToastTitle>
          </Toast>
        ),
      });
    } catch {
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="error" variant="solid">
            <ToastTitle>Nudge failed</ToastTitle>
          </Toast>
        ),
      });
    }
  };
  const removeFriend = async (id: string) => {
    setMenuId(undefined);
    try {
      await remove.mutateAsync(id);
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="success" variant="solid">
            <ToastTitle>Friend removed</ToastTitle>
          </Toast>
        ),
      });
    } catch {
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="error" variant="solid">
            <ToastTitle>Removal failed</ToastTitle>
          </Toast>
        ),
      });
    }
  };
  if (friendsQuery.isPending || progressQuery.isPending) {
    return <FriendLoading label="Leaderboard loading" />;
  }
  if (friendsQuery.isError || progressQuery.isError) {
    return (
      <FriendError
        label="Leaderboard error state"
        retryLabel="Retry leaderboard"
        onRetry={() => {
          void Promise.all([friendsQuery.refetch(), progressQuery.refetch()]);
        }}
      />
    );
  }
  if (progress.length === 0) {
    return (
      <FriendEmpty
        label="Leaderboard empty state"
        title="No friends yet"
        description="Add friends to compare today's progress."
      />
    );
  }
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-3 px-5 pb-8"
      showsVerticalScrollIndicator={false}
    >
      <Text className="pb-2 text-2xl font-medium text-on-surface">Daily</Text>
      {progress.map((friend) => {
        const link = friends.find((item) => item.user.id === friend.user.id);
        const menuOpen = menuId === friend.user.id;
        return (
          <View
            key={friend.user.id}
            accessibilityLabel={`Friend progress for ${friend.user.username}`}
            className="min-h-24 flex-row items-center rounded-xl bg-surface-container-low px-5 py-4"
          >
            <Text className="flex-1 text-base text-on-surface">{friend.user.username}</Text>
            {link && (
              <Button
                accessibilityLabel={`Nudge ${friend.user.username}`}
                variant="link"
                size="sm"
                isDisabled={nudge.isPending}
                onPress={() => void nudgeFriend(link.id)}
                className="h-10 w-10 rounded-full p-0"
              >
                <ButtonIcon as={Hand} className="text-on-surface-variant" />
              </Button>
            )}
            <View className="items-end gap-1">
              <View className="flex-row items-center gap-2">
                <Icon as={Clock3} size="sm" className="text-on-surface-variant" />
                <Text className="text-lg text-on-surface">{friend.focus_min} min</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Icon as={ListChecks} size="sm" className="text-on-surface-variant" />
                <Text className="text-sm text-on-surface-variant">
                  {friend.completed_subtasks}{' '}
                  {friend.completed_subtasks === 1 ? 'subtask' : 'subtasks'}
                </Text>
              </View>
            </View>
            {link && (
              <View className="ml-2 items-end gap-1">
                <Button
                  accessibilityLabel={`More actions for ${friend.user.username}`}
                  variant="link"
                  size="sm"
                  isDisabled={remove.isPending}
                  onPress={() => setMenuId(menuOpen ? undefined : friend.user.id)}
                  className="h-10 w-10 rounded-full p-0"
                >
                  <ButtonIcon as={MoreHorizontal} className="text-on-surface-variant" />
                </Button>
                {menuOpen && (
                  <Button
                    accessibilityLabel={`Remove ${friend.user.username}`}
                    variant="outline"
                    action="negative"
                    size="xs"
                    isDisabled={remove.isPending}
                    onPress={() => void removeFriend(link.id)}
                    className="rounded-lg border-error bg-surface-container-lowest"
                  >
                    <ButtonText className="text-error">Remove</ButtonText>
                  </Button>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
