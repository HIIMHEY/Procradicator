import { API_ROUTES } from '@/config/env';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FriendIdSchema,
  FriendRequestSchema,
  NudgeIdSchema,
  type FriendId,
  type NudgeId,
} from '../schemas';

const csrfHeaders = {
  'Content-Type': 'application/json',
  'X-CSRF-Token': '1',
};

async function sendRequest(username: string): Promise<FriendId> {
  const body = FriendRequestSchema.parse({ username });
  const res = await fetch(API_ROUTES.FRIENDS.REQUESTS, {
    method: 'POST',
    headers: csrfHeaders,
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  return FriendIdSchema.parse(await res.json());
}

async function acceptRequest(id: string): Promise<void> {
  const res = await fetch(API_ROUTES.FRIENDS.REQUEST(id), {
    method: 'PATCH',
    headers: csrfHeaders,
    body: JSON.stringify({ status: 'accepted' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
}

async function rejectRequest(id: string): Promise<void> {
  const res = await fetch(API_ROUTES.FRIENDS.REQUEST(id), {
    method: 'DELETE',
    headers: csrfHeaders,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
}

async function removeFriend(id: string): Promise<void> {
  const res = await fetch(API_ROUTES.FRIENDS.DETAIL(id), {
    method: 'DELETE',
    headers: csrfHeaders,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
}

async function sendNudge(id: string): Promise<NudgeId> {
  const res = await fetch(API_ROUTES.FRIENDS.NUDGE(id), {
    method: 'POST',
    headers: csrfHeaders,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  return NudgeIdSchema.parse(await res.json());
}

type FriendAction<T> = (value: string) => Promise<T>;

function useFriendAction<T>(action: FriendAction<T>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    networkMode: 'online',
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
  });
}

export const useSendFriendRequest = () => useFriendAction(sendRequest);
export const useAcceptFriendRequest = () => useFriendAction(acceptRequest);
export const useRejectFriendRequest = () => useFriendAction(rejectRequest);
export const useRemoveFriend = () => useFriendAction(removeFriend);
export const useSendNudge = () => useFriendAction(sendNudge);
