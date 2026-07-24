import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { MenuIcon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { BarChart3, LayoutGrid, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, View } from 'react-native';

type NavPage = 'analytics' | 'tasks';

interface NavBarProps {
  active: NavPage;
  title: string;
}

const items = [
  { key: 'tasks', label: 'Dashboard', route: '/tasks', icon: LayoutGrid },
  { key: 'analytics', label: 'Analytics', route: '/analytics', icon: BarChart3 },
] as const;

export function NavBar({ active, title }: NavBarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const goTo = (page: NavPage, route: '/analytics' | '/tasks') => {
    setOpen(false);
    if (page !== active) router.replace(route);
  };

  return (
    <>
      <HStack className="h-14 w-full items-center border-b border-slate-200 bg-white px-3">
        <Button
          accessibilityLabel="Open navigation"
          variant="link"
          onPress={() => setOpen(true)}
          className="h-10 w-10 rounded-full p-0"
        >
          <ButtonIcon as={MenuIcon} className="text-slate-700" />
        </Button>
        <Text className="ml-1 text-base font-medium text-slate-800">{title}</Text>
      </HStack>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 flex-row">
          <View
            accessibilityLabel="Navigation menu"
            className="h-full w-72 max-w-[85%] bg-white px-4 pb-8 pt-4"
          >
            <HStack className="mb-8 items-center justify-between">
              <Text className="text-xl font-bold text-blue-600">Procradicator</Text>
              <Button
                accessibilityLabel="Close navigation"
                variant="link"
                onPress={() => setOpen(false)}
                className="h-10 w-10 rounded-full p-0"
              >
                <ButtonIcon as={X} className="text-slate-700" />
              </Button>
            </HStack>

            <View className="gap-2">
              {items.map((item) => {
                const selected = item.key === active;
                return (
                  <Button
                    key={item.key}
                    accessibilityLabel={`Go to ${item.label.toLowerCase()}`}
                    accessibilityState={{ selected }}
                    variant={selected ? 'solid' : 'link'}
                    onPress={() => goTo(item.key, item.route)}
                    className={
                      selected
                        ? 'h-12 justify-start rounded-lg bg-blue-600 px-4'
                        : 'h-12 justify-start rounded-lg px-4'
                    }
                  >
                    <ButtonIcon
                      as={item.icon}
                      className={selected ? 'mr-3 text-white' : 'mr-3 text-slate-700'}
                    />
                    <ButtonText className={selected ? 'text-white' : 'text-slate-800'}>
                      {item.label}
                    </ButtonText>
                  </Button>
                );
              })}
            </View>
          </View>

          <Pressable
            accessibilityLabel="Close navigation overlay"
            onPress={() => setOpen(false)}
            className="flex-1 bg-black/20"
          />
        </View>
      </Modal>
    </>
  );
}
