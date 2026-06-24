import { LandingScreen } from '@/auth/components/LandingScreen';
import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function Index() {
  const router = useRouter(); //Moves user between screens
  const { data: currentUser, isError, isPending } = useCurrentUser();
  useEffect(() => {
    if (currentUser) {
      router.replace('/tasks');
    }
  }, [currentUser, router]);
  if (isPending || currentUser) {
    return (
      <Box className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-base text-slate-600">Loading...</Text>
      </Box>
    );
  }
  if (isError) {
    return (
      <Box className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-base text-red-600">Could not check login status.</Text>
      </Box>
    );
  }
  //Backend returns 401 (user unauthorized)
  return <LandingScreen />;
}
