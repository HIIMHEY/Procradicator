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

interface DragListHeaderInputProps {
  control: Control<ModifyTaskData>;
  errors?: FieldErrors<ModifyTaskData>;
}

export function DragListHeader({ control, errors }: DragListHeaderInputProps) {
  return (
    <Box className="px-4 pt-6 pb-2 gap-4">
      <FormControl isInvalid={!!errors?.title} className="w-full">
        <Input className="border-0 bg-transparent h-12 px-0">
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, value } }) => (
              <InputField
                placeholder="Task Title"
                className="text-xl font-bold text-slate-800"
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
        <Textarea className="border-0 bg-transparent h-auto px-0">
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <TextareaInput
                placeholder="Task Description"
                className="text-base text-slate-500"
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
    </Box>
  );
}
