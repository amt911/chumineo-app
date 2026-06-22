'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  loginSchema,
  type LoginDto,
  type LoginInputDto,
} from '@sobrebox/shared';
import { loginUser } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export function LoginForm() {
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInputDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      // zodResolver applies the Zod default, so rememberMe is always boolean at runtime
      const { accessToken, user } = await loginUser(values as LoginDto);
      setSession(accessToken, user);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && (
        <p role="alert">{errors.email.message ?? 'Invalid email'}</p>
      )}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p role="alert">{errors.password.message}</p>}

      <label>
        <input type="checkbox" {...register('rememberMe')} /> Remember me
      </label>

      {serverError && <p role="alert">{serverError}</p>}
      <button type="submit" disabled={isSubmitting}>
        Log in
      </button>
    </form>
  );
}
