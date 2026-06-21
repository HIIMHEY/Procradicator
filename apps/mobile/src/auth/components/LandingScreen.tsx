import { Button, ButtonText } from '@/components/ui/button';
import { type Href, useRouter } from 'expo-router';
import { AuthScreenLayout } from './AuthScreenLayout';

export function LandingScreen() {
  const router = useRouter();
  return (
    <AuthScreenLayout title="Procradicator" subtitle="Break tasks into focused sessions.">
      <Button
        accessibilityLabel="Go to register" //label for tests and accessbility tools
        size="lg"
        onPress={() => router.navigate('/register' as Href)}
        className="w-full rounded-lg bg-black"
      >
        <ButtonText className="text-base font-semibold text-white">Register</ButtonText>
      </Button>

      <Button
        accessibilityLabel="Go to login"
        size="lg"
        variant="outline"
        action="default"
        onPress={() => router.navigate('/login' as Href)}
        className="w-full rounded-lg border border-slate-900 bg-white"
      >
        <ButtonText className="text-base font-semibold text-slate-950">Login</ButtonText>
      </Button>
    </AuthScreenLayout>
  );
}
