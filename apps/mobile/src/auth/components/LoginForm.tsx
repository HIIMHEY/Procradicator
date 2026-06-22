import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, type Resolver, useForm } from 'react-hook-form';
//Controller connects custom UI components to React Hook form
import { useLogin } from '../hooks/useLogin';
import { loginSchema } from '../schemas';
import type { LoginInput } from '../types';
import { AuthScreenLayout } from './AuthScreenLayout';

export function LoginForm() {
  const router = useRouter();
  const loginMutation = useLogin();
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    setSubmitError(null);
    try {
      await loginMutation.mutateAsync(values);
      router.replace('/tasks');
    } catch {
      setSubmitError('Invalid username or password.');
    }
  });
  return (
    <AuthScreenLayout title="Login" showBackButton>
      <VStack className="gap-2">
        <Text className="text-sm font-semibold text-slate-600">Username</Text>
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
          <Text className="text-sm text-red-600">{errors.username.message}</Text>
        ) : null}
      </VStack>

      <VStack className="gap-2">
        <Text className="text-sm font-semibold text-slate-600">Password</Text>
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
          <Text className="text-sm text-red-600">{errors.password.message}</Text>
        ) : null}
      </VStack>

      {submitError ? <Text className="text-center text-sm text-red-600">{submitError}</Text> : null}

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
