import { Button, ButtonText } from '@/components/ui/button';
import { View } from 'react-native';

export type FriendTab = 'add' | 'leaderboard' | 'requests';

interface FriendTabsProps {
  active: FriendTab;
  onChange: (tab: FriendTab) => void;
}

const tabs: { key: FriendTab; label: string }[] = [
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'add', label: 'Add Friends' },
  { key: 'requests', label: 'Requests' },
];

export function FriendTabs({ active, onChange }: FriendTabsProps) {
  return (
    <View accessibilityRole="tablist" className="flex-row gap-2 px-5 py-6">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Button
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            role="tab"
            variant={selected ? 'solid' : 'link'}
            size="md"
            onPress={() => onChange(tab.key)}
            className={
              selected
                ? 'flex-1 rounded-full bg-blue-600 px-2'
                : 'flex-1 rounded-full bg-[#EAF0FF] px-2'
            }
          >
            <ButtonText
              className={selected ? 'text-sm font-medium text-white' : 'text-sm text-slate-600'}
            >
              {tab.label}
            </ButtonText>
          </Button>
        );
      })}
    </View>
  );
}
