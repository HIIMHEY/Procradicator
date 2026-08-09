import { Button, ButtonIcon } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Toast, ToastTitle, useToast } from '@/components/ui/toast';
import { useAcceptFriendRequest, useRejectFriendRequest } from '@/friends/hooks/useFriendActions';
import { useFriendRequests } from '@/friends/hooks/useFriendQueries';
import { Check, X } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { FriendEmpty, FriendError, FriendLoading } from './FriendState';

interface FriendRequestsProps {
  userId: string;
}

export function FriendRequests({ userId }: FriendRequestsProps) {
  const toast = useToast();
  const query = useFriendRequests(userId);
  const accept = useAcceptFriendRequest();
  const reject = useRejectFriendRequest();
  const data = query.data ?? [];
  const incoming = data.filter((request) => request.is_incoming);
  const sent = data.filter((request) => !request.is_incoming);
  const busy = accept.isPending || reject.isPending;
  const acceptRequest = async (id: string) => {
    try {
      await accept.mutateAsync(id);
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="success" variant="solid">
            <ToastTitle>Request accepted</ToastTitle>
          </Toast>
        ),
      });
    } catch {
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="error" variant="solid">
            <ToastTitle>Accept failed</ToastTitle>
          </Toast>
        ),
      });
    }
  };
  const rejectRequest = async (id: string) => {
    try {
      await reject.mutateAsync(id);
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="success" variant="solid">
            <ToastTitle>Request rejected</ToastTitle>
          </Toast>
        ),
      });
    } catch {
      toast.show({
        placement: 'top',
        render: () => (
          <Toast action="error" variant="solid">
            <ToastTitle>Reject failed</ToastTitle>
          </Toast>
        ),
      });
    }
  };
  if (query.isPending) {
    return <FriendLoading label="Requests loading" />;
  }
  if (query.isError) {
    return (
      <FriendError
        label="Requests error state"
        retryLabel="Retry requests"
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (data.length === 0) {
    return (
      <FriendEmpty
        label="Requests empty state"
        title="No pending requests"
        description="Friend requests you send or receive will appear here."
      />
    );
  }
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-7 px-5 pb-8"
      showsVerticalScrollIndicator={false}
    >
      <View accessibilityLabel="Incoming friend requests" className="gap-3">
        <Text className="pb-1 text-2xl font-medium text-on-surface">Incoming</Text>
        {incoming.map((request) => (
          <View
            key={request.id}
            className="min-h-20 flex-row items-center rounded-xl bg-surface-container-low px-4 py-3"
          >
            <Text className="flex-1 text-base text-on-surface">{request.user.username}</Text>
            <Button
              accessibilityLabel={`Accept ${request.user.username}`}
              size="sm"
              isDisabled={busy}
              onPress={() => void acceptRequest(request.id)}
              className="h-11 w-11 rounded-xl bg-primary p-0"
            >
              <ButtonIcon as={Check} className="text-on-primary" />
            </Button>
            <Button
              accessibilityLabel={`Reject ${request.user.username}`}
              variant="link"
              size="sm"
              isDisabled={busy}
              onPress={() => void rejectRequest(request.id)}
              className="ml-2 h-11 w-11 rounded-xl bg-surface-container-high p-0"
            >
              <ButtonIcon as={X} className="text-on-surface-variant" />
            </Button>
          </View>
        ))}
      </View>

      <View accessibilityLabel="Sent friend requests" className="gap-3">
        <Text className="pb-1 text-2xl font-medium text-on-surface">Sent</Text>
        {sent.map((request) => (
          <View
            key={request.id}
            className="min-h-20 flex-row items-center rounded-xl bg-surface-container-low px-4 py-3"
          >
            <Text className="flex-1 text-base text-on-surface">{request.user.username}</Text>
            <View className="rounded-xl bg-surface-container-lowest px-4 py-2">
              <Text className="font-medium text-primary">Pending</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
