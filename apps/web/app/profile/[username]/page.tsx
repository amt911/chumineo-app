import { notFound } from 'next/navigation';
import { fetchPublicProfile } from '@/lib/api';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  let profile;
  try {
    profile = await fetchPublicProfile(username);
  } catch {
    notFound();
  }
  return (
    <main>
      <h1>{profile.username}</h1>
      <p>Member since {new Date(profile.memberSince).toLocaleDateString()}</p>
    </main>
  );
}
