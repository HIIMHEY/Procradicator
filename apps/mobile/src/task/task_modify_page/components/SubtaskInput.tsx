import { Box } from '@/components/ui/box';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ModifySubtaskData, TaskModifyMode } from '@/task/schema';
import { FieldErrors } from 'react-hook-form';
import { Button, ButtonText } from '@/components/ui/button';
import { Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel } from '@/components/ui/checkbox';
import { CheckIcon, Icon, AlertCircleIcon } from '@/components/ui/icon';
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlError,
  FormControlErrorText,
  FormControlErrorIcon,
} from '@/components/ui/form-control';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import dayjs from 'dayjs';

interface SubtaskInputProps {
  mode: TaskModifyMode;
  value: ModifySubtaskData;
  onChange: (value: ModifySubtaskData) => void;
  errors?: FieldErrors<ModifySubtaskData>;
  onDone: () => void;
}

export function SubtaskInput({ mode, value, onChange, errors, onDone }: SubtaskInputProps) {
  const updateField = (key: keyof ModifySubtaskData, newValue: string | boolean) => {
    onChange({
      ...value,
      [key]: newValue,
    });
  };

  return (
    <Box className="w-full max-w-[320px] p-4 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
      <Text className="text-lg font-semibold text-on-surface mb-4 text-center">{mode} Subtask</Text>

      <FormControl isInvalid={!!errors?.title} className="mb-3">
        <FormControlLabel>
          <FormControlLabelText>Title</FormControlLabelText>
        </FormControlLabel>
        <Input className="bg-surface-container-low border border-outline-variant rounded-lg h-11">
          <InputField
            placeholder="Enter something you have to do..."
            value={value?.title || ''}
            onChangeText={(text) => updateField('title', text)}
            className="text-sm text-on-surface"
          />
        </Input>
        <FormControlError>
          <FormControlErrorIcon as={AlertCircleIcon} />
          <FormControlErrorText className="text-xs text-error ml-1">
            {errors?.title?.message}
          </FormControlErrorText>
        </FormControlError>
      </FormControl>

      <FormControl isInvalid={!!errors?.description} className="mb-3">
        <FormControlLabel>
          <FormControlLabelText>Description</FormControlLabelText>
        </FormControlLabel>
        <Textarea className="bg-surface-container-low border border-outline-variant rounded-lg h-20 items-start">
          <TextareaInput
            placeholder="Describe what you have to do..."
            multiline
            numberOfLines={4}
            value={value?.description || ''}
            onChangeText={(text) => updateField('description', text)}
            className="text-sm text-on-surface py-2 w-full h-full"
          />
        </Textarea>
        <FormControlError>
          <FormControlErrorIcon as={AlertCircleIcon} />
          <FormControlErrorText className="text-xs text-error ml-1">
            {errors?.description?.message}
          </FormControlErrorText>
        </FormControlError>
      </FormControl>

      <FormControl isInvalid={!!errors?.est_m} className="mb-4">
        <FormControlLabel>
          <FormControlLabelText>Time Estimate (minutes)</FormControlLabelText>
        </FormControlLabel>
        <Input className="bg-surface-container-low border border-outline-variant rounded-lg h-11">
          <InputField
            placeholder="How long would it take to complete this?"
            value={String(value?.est_m) || ''}
            onChangeText={(text) => updateField('est_m', text)}
            className="text-sm text-on-surface"
          />
        </Input>
        <FormControlError>
          <FormControlErrorIcon as={AlertCircleIcon} />
          <FormControlErrorText className="text-xs text-error ml-1">
            {errors?.est_m?.message}
          </FormControlErrorText>
        </FormControlError>
      </FormControl>

      <Box className="flex-row justify-between items-center my-2">
        <Checkbox
          value={value.id || dayjs().toISOString()}
          isChecked={value?.is_done ?? false}
          onChange={(bool: boolean) => updateField('is_done', bool)}
          size="md"
        >
          <CheckboxLabel className="ml-2 text-sm text-on-surface-variant">
            Mark as completed
          </CheckboxLabel>
          <CheckboxIndicator>
            <CheckboxIcon as={CheckIcon} />
          </CheckboxIndicator>
        </Checkbox>
      </Box>

      <Box className="items-end mt-3">
        <Button
          onPress={onDone}
          className="bg-[#3B59B6] rounded-lg py-2 px-4 h-10 flex-row items-center justify-center"
        >
          <ButtonText className="text-white font-semibold text-sm">Done</ButtonText>
          <Icon as={CheckIcon} className="text-white" />
        </Button>
      </Box>
    </Box>
  );
}
