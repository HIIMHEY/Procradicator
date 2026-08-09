import { useLogout } from '@/auth/hooks/useLogout';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { MenuIcon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { Toast, ToastDescription, ToastTitle, useToast } from '@/components/ui/toast';
import { BarChart3, LayoutGrid, LogOut, UserRound, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, View } from 'react-native';

type NavPage = 'analytics' | 'friends' | 'tasks';

interface NavBarProps {
  active: NavPage;
  title: string;
}

const items = [
  { key: 'tasks', label: 'Dashboard', route: '/tasks', icon: LayoutGrid },
  { key: 'analytics', label: 'Analytics', route: '/analytics', icon: BarChart3 },
  { key: 'friends', label: 'Friends', route: '/friends', icon: UserRound },
] as const;

export function NavBar({ active, title }: NavBarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const { mutateAsync: logout, isPending: isLoggingOut } = useLogout();

  const goTo = (page: NavPage, route: '/analytics' | '/friends' | '/tasks') => {
    setOpen(false);
    if (page !== active) router.replace(route);
  };

  const handleLogout = async () => {
    setOpen(false);
    try {
      await logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not log out.';
      toast.show({
        placement: 'top',
        duration: 3000,
        render: () => (
          <Toast action="error" variant="solid">
            <ToastTitle>Logout Failed</ToastTitle>
            <ToastDescription>{message}</ToastDescription>
          </Toast>
        ),
      });
    }
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
        <Text className="ml-1 text-2xl font-bold text-slate-900">{title}</Text>
      </HStack>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 flex-row">
          <View
            accessibilityLabel="Navigation menu"
            className="h-full w-72 max-w-[85%] flex-col bg-white px-4 pb-8 pt-4"
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

            <Button
              accessibilityLabel="Log out"
              variant="link"
              onPress={handleLogout}
              isDisabled={isLoggingOut}
              className="mt-auto h-12 justify-start rounded-lg px-4"
            >
              <ButtonIcon as={LogOut} className="mr-3 text-red-500" />
              <ButtonText className="text-red-600">
                {isLoggingOut ? 'Logging out...' : 'Log out'}
              </ButtonText>
            </Button>
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
