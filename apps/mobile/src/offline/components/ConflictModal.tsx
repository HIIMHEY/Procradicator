import { useCurrentUser } from '@/auth/hooks/useCurrentUser';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { keepLocalTask, keepServerTask, listTaskConflicts } from '@/offline/taskSync';
import { keepLocalFocus, keepServerFocus, listFocusConflicts } from '@/offline/focusSync';
import type { FocusConflictRecord, TaskConflictRecord } from '@/offline/databaseTypes';
import { requestSync } from '@/offline/TaskSyncProvider';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';

export default function ConflictModal() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [conflict, setConflict] = useState<TaskConflictRecord | FocusConflictRecord | null>(null);

  const refresh = useCallback(async () => {
    if (!currentUser) {
      setConflict(null);
      return;
    }
    const conflicts = [
      ...(await listTaskConflicts(currentUser.id)),
      ...(await listFocusConflicts(currentUser.id)),
    ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    setConflict(conflicts[0] ?? null);
  }, [currentUser]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const finishResolution = async () => {
    if (!currentUser || !conflict) return;
    await queryClient.invalidateQueries({ queryKey: ['task', currentUser.id] });
    await queryClient.invalidateQueries({ queryKey: ['focus', currentUser.id] });
    await refresh();
  };

  const handleKeepMine = async () => {
    if (!conflict) return;
    if ('localSession' in conflict) {
      await keepLocalFocus(conflict);
    } else {
      await keepLocalTask(conflict);
    }
    requestSync();
    await finishResolution();
  };

  const handleKeepServer = async () => {
    if (!conflict) return;
    if ('localSession' in conflict) {
      await keepServerFocus(conflict);
    } else {
      await keepServerTask(conflict);
    }
    await finishResolution();
  };

  if (!conflict) return null;
  const isFocusConflict = 'localSession' in conflict;
  const localLabel = isFocusConflict
    ? `${conflict.localSession.state.completedIds.length} completed subtasks`
    : (conflict.localTask?.title ?? 'Deleted on this device');
  const serverLabel = isFocusConflict
    ? `${conflict.serverSession.work_cycles} work cycles`
    : conflict.serverTask.title;
  const localUpdatedAt = isFocusConflict
    ? conflict.localSession.session.updated_at
    : (conflict.localTask?.updated_at ?? conflict.createdAt);
  const serverUpdatedAt = isFocusConflict
    ? conflict.serverSession.updated_at
    : conflict.serverTask.updated_at;

  return (
    <Box className="absolute inset-0 z-50 items-center justify-center bg-black/50">
      <Box className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <Heading size="sm" className="mb-2">
          Conflict Detected
        </Heading>
        <Text className="mb-4 text-sm text-gray-600">
          This {isFocusConflict ? 'focus session' : 'task'} changed on the server while you were
          offline. Choose which version to keep.
        </Text>
        <Box className="mb-2 rounded-lg border border-gray-200 p-3">
          <Text className="mb-1 text-xs font-semibold text-gray-500">YOUR LOCAL VERSION</Text>
          <Text>{localLabel}</Text>
          <Text className="text-xs text-gray-400">
            Modified: {dayjs(localUpdatedAt).format('MMM D, h:mm A')}
          </Text>
        </Box>
        <Box className="mb-4 rounded-lg border border-gray-200 p-3">
          <Text className="mb-1 text-xs font-semibold text-gray-500">SERVER VERSION</Text>
          <Text>{serverLabel}</Text>
          <Text className="text-xs text-gray-400">
            Modified: {dayjs(serverUpdatedAt).format('MMM D, h:mm A')}
          </Text>
        </Box>
        <Box className="flex-row justify-end gap-2">
          <Pressable onPress={handleKeepMine}>
            <Box className="rounded-md border border-gray-300 px-4 py-2">
              <Text className="text-sm font-medium">Keep Mine</Text>
            </Box>
          </Pressable>
          <Button size="sm" onPress={handleKeepServer}>
            <ButtonText>Keep Server</ButtonText>
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
