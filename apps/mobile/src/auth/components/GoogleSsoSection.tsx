import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useGoogleSso } from '../hooks/useGoogleSso';

type GoogleSsoSectionProps = {
  prompt: string;
};

export function GoogleSsoSection({ prompt }: GoogleSsoSectionProps) {
  const googleSso = useGoogleSso();
  return (
    <VStack className="gap-3">
      <Box className="mx-8 h-px bg-slate-900" />
      <Text className="text-center text-sm text-slate-700">{prompt}</Text>
      <Button
        accessibilityLabel="Continue with Google"
        size="lg"
        onPress={() => {
          googleSso.mutate(); //calls mutation fn startGoogleSso
        }}
        isDisabled={googleSso.isPending}
        className="w-full rounded-lg bg-black"
      >
        <HStack className="items-center justify-center gap-3">
          <ButtonText className="text-xl font-bold text-white">G</ButtonText>
          <ButtonText className="text-base font-semibold text-white">
            {googleSso.isPending ? 'Opening Google...' : 'Continue with Google'}
          </ButtonText>
        </HStack>
      </Button>
      {googleSso.error instanceof Error ? (
        <Text className="text-center text-sm text-red-600">{googleSso.error.message}</Text>
      ) : null}
    </VStack>
  );
}
