'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterDto } from '@sobrebox/shared';
import { registerUser } from '@/lib/api';

export function RegisterForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterDto>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await registerUser(values);
      setMessage(res.message);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Registration failed',
      );
    }
  });

  if (message) return <p role="status">{message}</p>;

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register('email')} />
      {errors.email && (
        <p role="alert">{errors.email.message ?? 'Invalid email'}</p>
      )}

      <label htmlFor="username">Username (optional)</label>
      <input
        id="username"
        {...register('username', {
          setValueAs: (v: string) => (v === '' ? undefined : v),
        })}
      />
      {errors.username && <p role="alert">{errors.username.message}</p>}

      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register('password')} />
      {errors.password && <p role="alert">{errors.password.message}</p>}

      {serverError && <p role="alert">{serverError}</p>}
      <button type="submit" disabled={isSubmitting}>
        Sign up
      </button>
    </form>
  );
}
