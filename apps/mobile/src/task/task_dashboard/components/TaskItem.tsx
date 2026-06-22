import { useState } from 'react';
import { TouchableOpacity, Text, LayoutAnimation } from 'react-native';
import { Task } from '../../schema';
import { HStack } from '@/components/ui/hstack';
import { Icon, EditIcon, ChevronLeftIcon, TrashIcon, ChevronRightIcon } from '@/components/ui/icon';
import { Box } from '@/components/ui/box';
import useDeleteTask from '@/task/hooks/useDeleteTask';
import { useRouter } from 'expo-router';

interface TaskItemProps {
  task: Task;
}

export function TaskItem({ task }: TaskItemProps) {
  const [showOptions, setShowOptions] = useState(false);
  const router = useRouter();
  const isCompleted = task.subtasks.length > 0 && task.subtasks.every((sub) => sub.is_done);
  const { mutate: DeleteMutate } = useDeleteTask(task.id);
  const toggleOptions = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowOptions(!showOptions);
  };

  return (
    <HStack className="w-full border border-black rounded-2xl mb-4 overflow-hidden bg-white min-h-[70px] items-stretch">
      <Box className="flex-1 justify-center px-4 py-3 border-r border-black">
        <Text
          className={`text-black text-base font-medium ${showOptions ? 'line-clamp-2' : 'truncate'}`}
        >
          {task.title}
        </Text>
      </Box>

      <TouchableOpacity
        onPress={toggleOptions}
        className="justify-center items-center px-5 bg-white h-full border-r border-black"
      >
        <Icon
          as={showOptions ? ChevronRightIcon : ChevronLeftIcon}
          className="text-black w-6 h-6"
        />
      </TouchableOpacity>

      {showOptions && (
        <HStack className="bg-white items-stretch">
          {/* ok not sure if should change these to use buttons instead? */}
          {!isCompleted && (
            <TouchableOpacity
              onPress={() => router.navigate(`/tasks/${task.id}/edit`)}
              className="px-4 justify-center items-center flex-row bg-white border-r border-black h-full"
            >
              <Icon as={EditIcon} className="text-black w-4 h-4 mr-1" />
              <Text className="text-black font-semibold text-sm">Edit</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => DeleteMutate()}
            className="px-4 justify-center items-center flex-row bg-white h-full"
          >
            <Icon as={TrashIcon} className="text-red-600 w-4 h-4 mr-1" />
            <Text className="text-red-600 font-semibold text-sm">Delete</Text>
          </TouchableOpacity>
        </HStack>
      )}
    </HStack>
  );
}
