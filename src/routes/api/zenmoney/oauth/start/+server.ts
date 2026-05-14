import { randomUUID } from "node:crypto";
import type { Cookies } from "@sveltejs/kit";
import { buildAuthorizeUrl } from "$lib/server/zenmoney/oauth";
import { getZenmoneyServerConfig } from "$lib/server/zenmoney/config";
import {
  OAUTH_STATE_TTL_SECONDS,
  STATE_COOKIE,
} from "$lib/server/zenmoney/cookies";

export const GET = async ({ cookies }: { cookies: Cookies }) => {
  const config = getZenmoneyServerConfig();
  if (!config.oauthEnabled) {
    return new Response("Not found", { status: 404 });
  }

  const state = randomUUID();

  cookies.set(STATE_COOKIE, state, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });

  return new Response(null, {
    status: 302,
    headers: {
      location: buildAuthorizeUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        state,
      }),
    },
  });
};
