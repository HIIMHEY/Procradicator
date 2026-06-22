import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { Heading } from '@/components/ui/heading';
import { Icon } from '@/components/ui/icon';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { AlertTriangle } from 'lucide-react-native';

interface ErrorFallbackProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorFallback({ message, onRetry }: ErrorFallbackProps) {
  const errorMessage = message || 'Something went wrong while loading your content.';

  return (
    <Center className="w-full p-4 flex-1">
      <Box className="max-w-lg bg-white dark:bg-black border rounded-xl p-6 w-full">
        <VStack className="space-y-4 items-center text-center">
          <Icon as={AlertTriangle} size="xl" className="text-red-500" />

          <Heading className="text-lg font-semibold text-black ">Loading Error</Heading>

          <Text className="text-sm text-gray-500 text-center">{errorMessage}</Text>

          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              action="negative"
              className="mt-2 border-red-500 active:bg-red-50"
              onPress={onRetry}
            >
              <ButtonText className="text-red-500">Try Again</ButtonText>
            </Button>
          )}
        </VStack>
      </Box>
    </Center>
  );
}
