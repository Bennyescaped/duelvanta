import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { RoomServiceClient } from "npm:livekit-server-sdk@2.19.0";

type Revocation = {
  id: number;
  match_id: string;
  epoch: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  },
});

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error("missing_config");
  return value;
};

const secureEqual = (left: string, right: string) => {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
};

const isMissingRoom = (error: unknown) => /not found|does not exist/i.test(
  error instanceof Error ? error.message : String(error),
);

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization") ?? "";
  const reconcilerSecret = request.headers.get("x-duelvanta-reconciler") ?? "";
  const authorized = secureEqual(authorization, `Bearer ${serviceRoleKey}`)
    || secureEqual(reconcilerSecret, required("MEDIA_RECONCILER_SECRET"));

  if (!authorized) return json({ error: "unauthorized" }, 401);

  try {
    const database = createClient(required("SUPABASE_URL"), serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await database.rpc(
      "get_pending_battle_spectator_media_revocations",
      { p_limit: 25 },
    );
    if (error) throw new Error("revocation_read_failed");

    const livekit = new RoomServiceClient(
      required("LIVEKIT_URL").replace(/^wss:/, "https:").replace(/^ws:/, "http:"),
      required("LIVEKIT_API_KEY"),
      required("LIVEKIT_API_SECRET"),
    );
    let processed = 0;
    let failed = 0;

    for (const row of (data ?? []) as Revocation[]) {
      try {
        const room = `dv-${row.match_id}-${row.epoch}`;
        const participants = await livekit.listParticipants(room).catch((error: unknown) => {
          if (isMissingRoom(error)) return [];
          throw error;
        });
        const revokeTokenTs = BigInt(Math.floor(Date.now() / 1000) + 5);

        for (const participant of participants) {
          await livekit.removeParticipant(room, participant.identity, { revokeTokenTs });
        }

        const completion = await database.rpc(
          "complete_battle_spectator_media_revocation",
          { p_id: row.id },
        );
        if (completion.error || completion.data !== true) {
          throw new Error("revocation_completion_failed");
        }
        processed += 1;
      } catch {
        failed += 1;
        console.error("spectator_media_revocation_failed", row.id);
      }
    }

    return json({ processed, failed });
  } catch (error) {
    console.error(
      "spectator_media_reconciler_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return json({ error: "reconciler_failed" }, 500);
  }
});
