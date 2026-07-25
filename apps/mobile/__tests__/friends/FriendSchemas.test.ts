import {
  FriendLinkSchema,
  FriendProgressSchema,
  FriendRequestSchema,
  NudgeSchema,
} from '@/friends/schemas';

const user = {
  id: '5f948d36-a324-4f7c-b4c0-a9e4df03b875',
  username: 'test_person_1',
};

test('parses the public friendship contract', () => {
  const link = FriendLinkSchema.parse({
    id: 'ed0d7a74-c737-4899-b7f6-476b1bd4f2c1',
    user,
    requested_at: '2026-07-25T02:00:00Z',
    accepted_at: null,
    is_incoming: true,
  });
  expect(link.user.username).toBe('test_person_1');
  expect(link.is_incoming).toBe(true);
});

test('rejects negative friend progress', () => {
  expect(() =>
    FriendProgressSchema.parse({
      user,
      focus_min: -1,
      completed_subtasks: 0,
    }),
  ).toThrow();
});

test('parses a received nudge', () => {
  const nudge = NudgeSchema.parse({
    id: '4fafc94a-38b0-4f27-9463-1df13a7337b0',
    sender: user,
    sent_at: '2026-07-25T03:00:00Z',
  });
  expect(nudge.sender.username).toBe('test_person_1');
});

test('normalizes a friend-request username', () => {
  expect(FriendRequestSchema.parse({ username: '  test_person_1  ' })).toEqual({
    username: 'test_person_1',
  });
  expect(() => FriendRequestSchema.parse({ username: '   ' })).toThrow();
});
