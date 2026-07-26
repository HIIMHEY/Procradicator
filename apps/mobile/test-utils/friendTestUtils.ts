export const userId = '5f948d36-a324-4f7c-b4c0-a9e4df03b875';
export const friendId = '0a67ad1b-24f8-4b01-8165-5e70017b348b';
export const linkId = 'ed0d7a74-c737-4899-b7f6-476b1bd4f2c1';

export const response = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;
