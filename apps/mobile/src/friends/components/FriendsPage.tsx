import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { NavBar } from '@/navigation/components/NavBar';
import { useState } from 'react';
import { View } from 'react-native';
import { FriendLeaderboard } from './FriendLeaderboard';
import { FriendRequests } from './FriendRequests';
import { FriendSearch } from './FriendSearch';
import { FriendTabs, type FriendTab } from './FriendTabs';

export function FriendsPage() {
  const { data: user } = useCurrentUser();
  const [tab, setTab] = useState<FriendTab>('leaderboard');
  const userId = user?.id ?? '';
  return (
    <View accessibilityLabel="Friends page" className="flex-1 bg-background">
      <NavBar active="friends" title="Friends" />
      <FriendTabs active={tab} onChange={setTab} />
      {tab === 'leaderboard' && <FriendLeaderboard userId={userId} />}
      {tab === 'add' && <FriendSearch userId={userId} />}
      {tab === 'requests' && <FriendRequests userId={userId} />}
    </View>
  );
}
