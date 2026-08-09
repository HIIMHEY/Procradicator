import { Image, type ImageStyle } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import googleLogo from '../../../assets/images/google-logo.png';
import { useGoogleSso } from '../hooks/useGoogleSso';

type GoogleSsoSectionProps = {
  prompt: string;
};

const googleLogoStyle: ImageStyle = {
  height: 18,
  width: 18,
};

export function GoogleSsoSection({ prompt }: GoogleSsoSectionProps) {
  const { mutate: continueWithGoogle, isPending: isOpeningGoogle, error } = useGoogleSso();
  return (
    <VStack className="gap-4 pt-1">
      <HStack className="items-center gap-4">
        <Box className="h-px flex-1 bg-outline-variant" />
        <Text className="text-center text-sm text-outline">{prompt}</Text>
        <Box className="h-px flex-1 bg-outline-variant" />
      </HStack>
      <Button
        accessibilityLabel="Continue with Google"
        size="xl"
        variant="outline"
        action="default"
        onPress={() => {
          continueWithGoogle();
        }}
        isDisabled={isOpeningGoogle}
        className="w-full rounded border border-outline bg-surface-container-lowest"
      >
        <HStack className="items-center justify-center gap-3">
          <Image
            accessible={false}
            source={googleLogo}
            resizeMode="contain"
            style={googleLogoStyle}
          />
          <ButtonText className="text-sm font-semibold text-on-background">
            {isOpeningGoogle ? 'Opening Google...' : 'Continue with Google'}
          </ButtonText>
        </HStack>
      </Button>
      {error instanceof Error ? (
        <Text className="text-center text-sm text-error">{error.message}</Text>
      ) : null}
    </VStack>
  );
}
