import { notFound } from 'next/navigation';
import { fetchPublicProfile } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
    <div className="flex justify-center pt-8">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <Avatar size="lg">
            <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h1 className="font-heading text-xl font-semibold">
              {profile.username}
            </h1>
            <p className="text-sm text-muted-foreground">
              Member since {new Date(profile.memberSince).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
