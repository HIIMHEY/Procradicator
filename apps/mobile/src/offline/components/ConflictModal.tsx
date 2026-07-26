import { useEffect, useRef, useState } from 'react';
import { readConflicts, deleteConflict, type ConflictRecord } from '@/offline/storage';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable } from 'react-native';
import dayjs from 'dayjs';
import { API_ROUTES } from '@/config/env';

export default function ConflictModal() {
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<ConflictRecord | null>(null);
  const allConflictsRef = useRef<ConflictRecord[]>([]);

  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const conflicts = await readConflicts();
        if (!active) return;
        const prev = allConflictsRef.current;
        const changed =
          conflicts.length !== prev.length ||
          conflicts.some((c, i) => c.id !== prev[i]?.id);
        if (changed) {
          allConflictsRef.current = conflicts;
          if (conflicts.length > 0) {
            setConflict((cur) => cur ?? conflicts[0]);
          } else {
            setConflict(null);
          }
        }
      } catch {
        // indexedDB not available, ignore
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleKeepMine = async () => {
    if (!conflict) return;
    try {
      const res = await fetch(`${API_ROUTES.TASKS.BASE}/${conflict.entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conflict.localData),
        credentials: 'include',
      });
      if (res.ok || res.status === 204) {
        await deleteConflict(conflict.id!);
        queryClient.invalidateQueries({ queryKey: ['task', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['task', 'detail', conflict.entityId] });
        const remaining = allConflictsRef.current.filter((c) => c.id !== conflict.id);
        allConflictsRef.current = remaining;
        setConflict(remaining[0] ?? null);
      }
    } catch {
      // will retry next cycle
    }
  };

  const handleKeepServer = async () => {
    if (!conflict) return;
    queryClient.setQueryData(
      ['task', 'detail', conflict.entityId],
      conflict.serverData,
    );
    await deleteConflict(conflict.id!);
    queryClient.invalidateQueries({ queryKey: ['task', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['task', 'detail', conflict.entityId] });
    const remaining = allConflictsRef.current.filter((c) => c.id !== conflict.id);
    allConflictsRef.current = remaining;
    setConflict(remaining[0] ?? null);
  };

  if (!conflict) return null;

  return (
    <Box className="absolute inset-0 z-50 items-center justify-center bg-black/50">
      <Box className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <Heading size="sm" className="mb-2">Conflict Detected</Heading>
        <Text className="mb-4 text-sm text-gray-600">
          This task was modified on the server while you were offline. Choose which version to keep.
        </Text>
        <Box className="mb-2 rounded-lg border border-gray-200 p-3">
          <Text className="mb-1 text-xs font-semibold text-gray-500">YOUR LOCAL VERSION</Text>
          <Text className="text-xs text-gray-400">
            Modified: {dayjs(conflict.localUpdatedAt).format('MMM D, h:mm A')}
          </Text>
        </Box>
        <Box className="mb-4 rounded-lg border border-gray-200 p-3">
          <Text className="mb-1 text-xs font-semibold text-gray-500">SERVER VERSION</Text>
          <Text className="text-xs text-gray-400">
            Modified: {dayjs(conflict.serverUpdatedAt).format('MMM D, h:mm A')}
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
