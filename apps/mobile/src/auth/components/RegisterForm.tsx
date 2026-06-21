import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { zodResolver } from '@hookform/resolvers/zod';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useRegister } from '../hooks/useRegister';
import { registerSchema } from '../schemas';
import type { RegisterInput } from '../types';
import { AuthScreenLayout } from './AuthScreenLayout';

export function RegisterForm() {
  const router = useRouter();
  const registerMutation = useRegister();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
    },
  });
  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await registerMutation.mutateAsync(values);
      router.replace('/login' as Href);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not create account.');
    }
  });
  return (
    <AuthScreenLayout title="Register" showBackButton>
      <VStack className="gap-2">
        <Text className="text-sm font-semibold text-slate-600">Email</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <Input size="lg" className="rounded-md border border-slate-900 bg-white">
              <InputField
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            </Input>
          )}
        />
        {errors.email ? <Text className="text-sm text-red-600">{errors.email.message}</Text> : null}
      </VStack>

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
                secureTextEntry //hides password text
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
        accessibilityLabel="Submit registration"
        size="lg"
        onPress={onSubmit}
        isDisabled={registerMutation.isPending}
        className="mt-2 w-full rounded-lg bg-black"
      >
        <ButtonText className="text-base font-semibold text-white">
          {registerMutation.isPending ? 'Creating account...' : 'Register'}
        </ButtonText>
      </Button>
    </AuthScreenLayout>
  );
}
