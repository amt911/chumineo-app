'use client';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  loginSchema,
  type LoginDto,
  type LoginInputDto,
} from '@sobrebox/shared';
import { loginUser } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { errorMessageKey, type ErrorMessageKey } from '@/lib/error-messages';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverErrorKey, setServerErrorKey] = useState<ErrorMessageKey | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginInputDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerErrorKey(null);
    try {
      // zodResolver applies the Zod default, so rememberMe is always boolean at runtime
      const { accessToken, user } = await loginUser(values as LoginDto);
      setSession(accessToken, user);
      // Leave the login form on success so the user sees they're in.
      router.push('/collections');
    } catch (err) {
      setServerErrorKey(
        errorMessageKey(err instanceof Error ? err.message : ''),
      );
    }
  });

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Log in</CardTitle>
          <CardDescription>
            Enter your credentials to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="login-form" onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.email.message ?? 'Invalid email'}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                />
                {errors.password && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="rememberMe"
                  render={({ field }) => (
                    <Checkbox
                      id="rememberMe"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
                <Label htmlFor="rememberMe" className="font-normal">
                  Remember me
                </Label>
              </div>

              {serverErrorKey && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{t(serverErrorKey)}</AlertDescription>
                </Alert>
              )}
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            form="login-form"
            className="w-full"
            disabled={isSubmitting}
          >
            Log in
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
