import { ActivityIndicator, Pressable, Text } from 'react-native';

type SubmitButtonProps = {
  isLoading: boolean;
  loadingText: string;
  normalText: string;
  onPress: () => void;
};

export function SubmitButton({ isLoading, loadingText, normalText, onPress }: SubmitButtonProps) {
  return (
    <Pressable
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 ${
        isLoading ? 'opacity-70' : ''
      }`}
      disabled={isLoading}
      onPress={onPress}
    >
      {isLoading ? <ActivityIndicator color="#ffffff" /> : null}
      <Text className="font-extrabold text-white">{isLoading ? loadingText : normalText}</Text>
    </Pressable>
  );
}
