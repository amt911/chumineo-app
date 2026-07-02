'use client';
import { useAuthStore } from '@/lib/auth-store';
import { EditCountryForm } from './edit-country-form';

export function ProfileCountrySection({
  username,
  country,
}: {
  username: string;
  country: string | null;
}) {
  const currentUsername = useAuthStore((s) => s.user?.username);
  if (currentUsername !== username) return null;
  return <EditCountryForm currentCountry={country} />;
}
