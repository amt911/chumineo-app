import type {
  AuthResponseDto,
  BrandDto,
  CollectionDetailDto,
  CollectionsPageDto,
  CollectionsQueryDto,
  LoginDto,
  MessageResponseDto,
  PublicProfileDto,
  PublicUserDto,
  RegisterDto,
} from '@sobrebox/shared';

// Server components (RSC) fetch the API directly on the host (absolute URL).
// Browser code calls the same-origin `/api` path, which Next rewrites to the API
// (see next.config.ts) — so it works from any device (phone over tailnet) with no
// CORS and no need to resolve `localhost` from the client.
const API_URL =
  typeof window === 'undefined'
    ? (process.env.API_INTERNAL_URL ?? 'http://localhost:3000')
    : '/api';

function buildQuery(query: Partial<CollectionsQueryDto>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function fetchCollectionsPage(
  query: Partial<CollectionsQueryDto>,
): Promise<CollectionsPageDto> {
  const res = await fetch(`${API_URL}/collections${buildQuery(query)}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`);
  return res.json() as Promise<CollectionsPageDto>;
}

export async function fetchBrands(): Promise<BrandDto[]> {
  const res = await fetch(`${API_URL}/brands`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch brands: ${res.status}`);
  return res.json() as Promise<BrandDto[]>;
}

export async function fetchCollectionDetail(
  slug: string,
): Promise<CollectionDetailDto> {
  const res = await fetch(`${API_URL}/collections/${slug}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch collection: ${res.status}`);
  return res.json() as Promise<CollectionDetailDto>;
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
