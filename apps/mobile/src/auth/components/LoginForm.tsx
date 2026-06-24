import { Button, ButtonText } from '@/components/ui/button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { Toast, ToastDescription, ToastTitle, useToast } from '@/components/ui/toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, type Resolver, useForm } from 'react-hook-form';
import { useLogin } from '../hooks/useLogin';
import { loginSchema } from '../schemas';
import type { LoginInput } from '../types';
import { AuthScreenLayout } from './AuthScreenLayout';

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const loginMutation = useLogin();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema as never) as Resolver<LoginInput>,
    defaultValues: {
      username: '',
      password: '',
    },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      await loginMutation.mutateAsync(values);
      toast.show({
        placement: 'top',
        duration: 3000,
        render: () => (
          <Toast action="success" variant="solid">
            <ToastTitle>Login Successful</ToastTitle>
          </Toast>
        ),
      });
      router.replace('/tasks');
    } catch {
      toast.show({
        placement: 'top',
        duration: 3000,
        render: () => (
          <Toast action="error" variant="solid">
            <ToastTitle>Login Failed</ToastTitle>
            <ToastDescription>Invalid username or password.</ToastDescription>
          </Toast>
        ),
      });
    }
  });
  return (
    <AuthScreenLayout title="Login" showBackButton>
      <FormControl isInvalid={!!errors.username}>
        <FormControlLabel>
          <FormControlLabelText>Username</FormControlLabelText>
        </FormControlLabel>
        <Controller
          control={control}
          name="username"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input size="lg" className="rounded-md border border-slate-900 bg-white">
              <InputField
                placeholder="Username"
                autoCapitalize="none"
                autoCorrect={false}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            </Input>
          )}
        />
        {errors.username ? (
          <FormControlError>
            <FormControlErrorText>{errors.username.message}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>

      <FormControl isInvalid={!!errors.password}>
        <FormControlLabel>
          <FormControlLabelText>Password</FormControlLabelText>
        </FormControlLabel>
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input size="lg" className="rounded-md border border-slate-900 bg-white">
              <InputField
                placeholder="Password"
                secureTextEntry
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            </Input>
          )}
        />
        {errors.password ? (
          <FormControlError>
            <FormControlErrorText>{errors.password.message}</FormControlErrorText>
          </FormControlError>
        ) : null}
      </FormControl>

      <Button
        accessibilityLabel="Submit login"
        size="lg"
        onPress={onSubmit}
        isDisabled={loginMutation.isPending}
        className="mt-2 w-full rounded-lg bg-black"
      >
        <ButtonText className="text-base font-semibold text-white">
          {loginMutation.isPending ? 'Logging in...' : 'Login'}
        </ButtonText>
      </Button>
    </AuthScreenLayout>
  );
}
