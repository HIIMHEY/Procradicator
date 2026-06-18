import { Text } from 'react-native';

import type { StatusMessage as StatusMessageType } from '../types/task';

type StatusMessageProps = {
  message: StatusMessageType | null;
};

export function StatusMessage({ message }: StatusMessageProps) {
  if (!message) {
    return null;
  }
  const className =
    message.kind === 'error'
      ? 'rounded-lg bg-red-50 p-3 leading-5 text-red-800'
      : 'rounded-lg bg-emerald-50 p-3 leading-5 text-emerald-800';
  return <Text className={className}>{message.text}</Text>;
}
