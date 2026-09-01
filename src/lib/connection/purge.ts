import 'server-only';

// Purging the OBJECT behind a deleted row.
//
// Deleting a message or a status removes the row that points at the photo. The
// photo itself is a separate thing in a separate service, and nothing was
// removing it — so "delete for everyone" left the picture in the bucket, and a
// status promised to last 24 hours left its picture there forever.
//
// Two facts decide where this lives:
//
//   · identity-service makes NO outbound HTTP calls at all. It knows the key and
//     nothing else; giving it a storage client so it could clean up after itself
//     would make the relationship store depend on the file store for a delete.
//   · storage-service does not know what a message is, so it cannot decide when
//     a key is finished with.
//
// The BFF already talks to both, so it is the one place that can hold both
// halves. It reads the freed key from the delete response, purges the object,
// and — this part matters — never lets the key reach the browser. A storage key
// in a JSON response is a key a client can keep.
//
// Failure here is logged, never fatal: the row IS gone, which is what the user
// asked for. An orphaned object is a cleanup problem, not a reason to tell
// someone their delete failed.
const GW = process.env.API_GATEWAY_URL ?? '';

/** Matches the ceiling storage-service enforces; over it, the batch is split. */
const MAX_PER_CALL = 200;

/**
 * Delete storage objects by key. Returns how many storage confirmed.
 *
 * Only `chat/` and `stories/` keys are accepted on the far side — this is not
 * the guard, it is a courtesy filter so an obviously wrong key never leaves the
 * process. storage-service rejects the batch itself either way.
 */
export async function purgeObjects(keys: (string | null | undefined)[]): Promise<number> {
  const clean = keys.filter(
    (k): k is string =>
      typeof k === 'string' && k.length > 0 && !k.includes('..') &&
      (k.startsWith('chat/') || k.startsWith('stories/')),
  );
  if (!GW || clean.length === 0) return 0;

  let purged = 0;
  for (let i = 0; i < clean.length; i += MAX_PER_CALL) {
    const batch = clean.slice(i, i + MAX_PER_CALL);
    try {
      const res = await fetch(`${GW}/api/storage/internal/purge-objects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': crypto.randomUUID(),
          ...(process.env.INTERNAL_SECRET && { 'x-internal-key': process.env.INTERNAL_SECRET }),
        },
        body: JSON.stringify({ keys: batch }),
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error('[connection/purge] storage refused:', res.status, batch.length, 'keys');
        continue;
      }
      const data = await res.json().catch(() => ({}));
      purged += Number(data?.data?.deleted ?? 0);
    } catch (err) {
      console.error('[connection/purge] network error:', (err as Error).message);
    }
  }
  return purged;
}

/**
 * Take the freed storage keys OUT of a gateway response, returning both the
 * keys and a body that no longer carries them.
 *
 * The envelope is NESTED — `{ success, data: { deleted, mediaKey } }` — and this
 * unwraps it in one place on purpose. Reading `body.mediaKey` on a nested shape
 * yields `undefined` with no error: the purge would quietly never run, and the
 * only symptom would be a storage bill nobody is looking at. This platform has
 * already paid for that exact mistake once, when a BFF read `.data.plan` on a
 * `.data.subscription.plan` envelope and locked Pro off for every paying user.
 *
 * Both shapes are handled rather than one, because a route that forwards a
 * different endpoint should not have to know which envelope it got.
 */
export function takeMediaKeys(body: Record<string, unknown>): {
  keys: string[];
  body: Record<string, unknown>;
} {
  const keys: string[] = [];

  const strip = (obj: Record<string, unknown>): Record<string, unknown> => {
    const { mediaKey, mediaKeys, ...rest } = obj;
    if (typeof mediaKey === 'string' && mediaKey) keys.push(mediaKey);
    if (Array.isArray(mediaKeys)) {
      for (const k of mediaKeys) if (typeof k === 'string' && k) keys.push(k);
    }
    return rest;
  };

  const outer = strip(body);
  const inner = outer.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    outer.data = strip(inner as Record<string, unknown>);
  }
  return { keys, body: outer };
}
