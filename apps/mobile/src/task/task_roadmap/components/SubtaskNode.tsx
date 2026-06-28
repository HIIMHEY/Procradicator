import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { ArrowDownIcon, CheckIcon, HelpCircleIcon, Icon } from '@/components/ui/icon';
import { Subtask } from '../../schema';
import { Button } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { Play } from 'lucide-react-native';

interface SubtaskNodeProps {
  data: Subtask;
  isLast: boolean;
  isWorkable: boolean;
}

export function SubtaskNode({ isWorkable, data, isLast }: SubtaskNodeProps) {
  const isDone = data.completed == data.estimate;
  const router = useRouter();
  return (
    <Box className={`px-4 my-1 items-center`}>
      <Box className="w-full items-center">
        <Text className="text-sm text-slate-700 font-medium mb-1.5">
          {data?.title || `???`}
          {data?.estimate ? `: ${data.estimate} min` : '??? min'}
        </Text>
        {isDone ? (
          <Button
            variant="solid"
            isDisabled={true}
            className="flex-row items-center justify-center bg-[#006105] border border-[#006105] rounded-xl px-4 py-1.5"
          >
            <Icon as={CheckIcon} color="white" />
          </Button>
        ) : isWorkable ? (
          <Button
            variant="solid"
            onPress={() => router.navigate(`/focus/${data.id}`)}
            className="flex-row items-center justify-center bg-[#ff9900] border border-[#ff9900] rounded-xl px-4 py-1.5"
          >
            <Icon as={Play} color="white" />
          </Button>
        ) : (
          <Button
            variant="solid"
            isDisabled={true}
            className="flex-row items-center justify-center bg-[#797979] border border-[#797979] rounded-xl px-4 py-1.5"
          >
            <Icon as={HelpCircleIcon} color="white" />
          </Button>
        )}
      </Box>
      {!isLast && <Icon as={ArrowDownIcon} />}
    </Box>
  );
}
