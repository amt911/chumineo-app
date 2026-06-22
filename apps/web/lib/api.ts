import {
  collectionsResponseSchema,
  type AuthResponseDto,
  type CollectionResponseDto,
  type LoginDto,
  type MessageResponseDto,
  type PublicProfileDto,
  type PublicUserDto,
  type RegisterDto,
} from '@sobrebox/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function fetchCollections(): Promise<CollectionResponseDto[]> {
  const res = await fetch(`${API_URL}/collections`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`);
  // Validate the wire payload against the shared schema so the return type is honest.
  return collectionsResponseSchema.parse(await res.json());
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(data?.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function registerUser(dto: RegisterDto): Promise<MessageResponseDto> {
  return postJson('/auth/register', dto);
}
export function loginUser(dto: LoginDto): Promise<AuthResponseDto> {
  return postJson('/auth/login', dto);
}
export function verifyEmail(token: string): Promise<MessageResponseDto> {
  return postJson('/auth/verify', { token });
}
export function resendVerification(email: string): Promise<MessageResponseDto> {
  return postJson('/auth/resend-verification', { email });
}
export function logoutUser(): Promise<MessageResponseDto> {
  return postJson('/auth/logout', {});
}

export async function fetchPublicProfile(
  username: string,
): Promise<PublicProfileDto> {
  const res = await fetch(`${API_URL}/users/${username}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  return res.json() as Promise<PublicProfileDto>;
}

export async function fetchMe(accessToken: string): Promise<PublicUserDto> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to fetch me: ${res.status}`);
  return res.json() as Promise<PublicUserDto>;
}
