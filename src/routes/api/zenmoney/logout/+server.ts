import { json } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { SESSION_COOKIE } from '$lib/server/zenmoney/cookies';
import { deleteSession } from '$lib/server/zenmoney/session-store';

export const POST = async ({ cookies }: { cookies: Cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE);
  if (sessionId) {
    await deleteSession(sessionId);
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return json({ ok: true });
};
