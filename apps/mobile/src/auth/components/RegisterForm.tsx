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
import { type Href, useRouter } from 'expo-router';
import { Controller, type Resolver, useForm } from 'react-hook-form';
import { useRegister } from '../hooks/useRegister';
import type { RegisterInput } from '../schemas';
import { registerSchema } from '../schemas';
import { AuthScreenLayout } from './AuthScreenLayout';
import { GoogleSsoSection } from './GoogleSsoSection';

export function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const { mutateAsync: register, isPending: isRegistering } = useRegister();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema as never) as Resolver<RegisterInput>,
    defaultValues: {
      email: '',
      username: '',
      password: '',
    },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      await register(values);
      toast.show({
        placement: 'top',
        duration: 3000,
        render: () => (
          <Toast action="success" variant="solid">
            <ToastTitle>Account Created</ToastTitle>
          </Toast>
        ),
      });
      router.replace('/login' as Href);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create account.';
      toast.show({
        placement: 'top',
        duration: 3000,
        render: () => (
          <Toast action="error" variant="solid">
            <ToastTitle>Registration Failed</ToastTitle>
            <ToastDescription>{message}</ToastDescription>
          </Toast>
        ),
      });
    }
  });
  return (
    <AuthScreenLayout title="Register" showBackButton>
      <FormControl isInvalid={!!errors.email}>
        <FormControlLabel>
          <FormControlLabelText>Email</FormControlLabelText>
        </FormControlLabel>
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
        <FormControlError>
          <FormControlErrorText>{errors.email?.message}</FormControlErrorText>
        </FormControlError>
      </FormControl>

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
        <FormControlError>
          <FormControlErrorText>{errors.username?.message}</FormControlErrorText>
        </FormControlError>
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
        <FormControlError>
          <FormControlErrorText>{errors.password?.message}</FormControlErrorText>
        </FormControlError>
      </FormControl>

      <Button
        accessibilityLabel="Submit registration"
        size="lg"
        onPress={onSubmit}
        isDisabled={isRegistering}
        className="mt-2 w-full rounded-lg bg-black"
      >
        <ButtonText className="text-base font-semibold text-white">
          {isRegistering ? 'Creating account...' : 'Register'}
        </ButtonText>
      </Button>

      <GoogleSsoSection prompt="or register with" />
    </AuthScreenLayout>
  );
}
