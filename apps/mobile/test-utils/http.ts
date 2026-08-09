export function response(
  body: unknown = null,
  okOrStatus: boolean | number = 200,
  status = 200,
): Response {
  const ok = typeof okOrStatus === 'boolean' ? okOrStatus : okOrStatus >= 200 && okOrStatus < 300;
  return {
    ok,
    status: typeof okOrStatus === 'number' ? okOrStatus : status,
    json: async () => body,
  } as Response;
}
