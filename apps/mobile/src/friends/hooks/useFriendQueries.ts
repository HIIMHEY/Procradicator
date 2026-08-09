import { API_ROUTES } from '@/config/env';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import {
  FriendLinkSchema,
  FriendProgressSchema,
  FriendUserSchema,
  type FriendLink,
  type FriendProgress,
  type FriendUser,
} from '../schemas';

const onlineOnly = {
  gcTime: 0,
  networkMode: 'online' as const,
  retry: false,
};

async function get<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    signal,
  });
  if (!res.ok) throw new Error(String(res.status));
  return schema.parse(await res.json());
}

const readFriends = (signal?: AbortSignal): Promise<FriendLink[]> =>
  get(API_ROUTES.FRIENDS.BASE, z.array(FriendLinkSchema), signal);

const readRequests = (signal?: AbortSignal): Promise<FriendLink[]> =>
  get(API_ROUTES.FRIENDS.REQUESTS, z.array(FriendLinkSchema), signal);

const readProgress = (signal?: AbortSignal): Promise<FriendProgress[]> =>
  get(API_ROUTES.FRIENDS.PROGRESS, z.array(FriendProgressSchema), signal);

const searchUsers = (username: string, signal?: AbortSignal): Promise<FriendUser[]> =>
  get(
    `${API_ROUTES.FRIENDS.SEARCH}?username=${encodeURIComponent(username)}`,
    z.array(FriendUserSchema),
    signal,
  );

export function useFriends(userId: string) {
  return useQuery({
    queryKey: ['friends', 'list', userId],
    queryFn: ({ signal }) => readFriends(signal),
    enabled: Boolean(userId),
    ...onlineOnly,
  });
}

export function useFriendRequests(userId: string) {
  return useQuery({
    queryKey: ['friends', 'requests', userId],
    queryFn: ({ signal }) => readRequests(signal),
    enabled: Boolean(userId),
    ...onlineOnly,
  });
}

export function useFriendProgress(userId: string) {
  return useQuery({
    queryKey: ['friends', 'progress', userId],
    queryFn: ({ signal }) => readProgress(signal),
    enabled: Boolean(userId),
    ...onlineOnly,
  });
}

export function useFriendSearch(userId: string, username: string) {
  const query = username.trim();
  return useQuery({
    queryKey: ['friends', 'search', userId, query],
    queryFn: ({ signal }) => searchUsers(query, signal),
    enabled: Boolean(userId && query),
    ...onlineOnly,
  });
}
