import { Box } from '@/components/ui/box';
import {
  FormControl,
  FormControlError,
  FormControlErrorIcon,
  FormControlErrorText,
} from '@/components/ui/form-control';
import { AlertCircleIcon } from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { ModifyTaskData } from '@/task/schema';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import { TaskDateTimePicker } from './TaskDateTimePicker';
import dayjs from 'dayjs';

interface DragListHeaderInputProps {
  control: Control<ModifyTaskData>;
  errors?: FieldErrors<ModifyTaskData>;
}

export function DragListHeader({ control, errors }: DragListHeaderInputProps) {
  return (
    <Box className="relative z-10 bg-surface-container-low px-4 pt-2 pb-4">
      <FormControl isInvalid={!!errors?.title} className="w-full">
        <Input className="h-12 border-0 border-b border-outline-variant rounded-none bg-transparent px-0">
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value } }) => (
              <InputField
                placeholder="Task Title"
                className="text-[22px] font-bold text-on-surface"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
        </Input>
        {errors?.title && (
          <FormControlError>
            <FormControlErrorIcon as={AlertCircleIcon} />
            <FormControlErrorText>{errors?.title.message}</FormControlErrorText>
          </FormControlError>
        )}
      </FormControl>
      <FormControl isInvalid={!!errors?.description} className="w-full">
        <Textarea className="h-auto border-0 rounded-none bg-transparent px-0">
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <TextareaInput
                placeholder="Task Description"
                className="text-sm text-on-surface-variant py-2"
                value={value}
                multiline
                scrollEnabled={false}
                onChangeText={onChange}
              />
            )}
          />
        </Textarea>
        {errors?.description && (
          <FormControlError>
            <FormControlErrorIcon as={AlertCircleIcon} />
            <FormControlErrorText>{errors?.description.message}</FormControlErrorText>
          </FormControlError>
        )}
      </FormControl>
      <Controller
        control={control}
        name="due_at"
        render={({ field: { onChange, value } }) => (
          <TaskDateTimePicker onChange={onChange} value={dayjs(value).toISOString()} />
        )}
      />
    </Box>
  );
}
