import type { Thread } from './useMessages';

const norm = (u: string | null | undefined) => (u ?? '').trim().replace(/^@+/, '').toLowerCase();

/**
 * May the caller clear SOMEONE ELSE's message in this thread for everybody?
 *
 * A group's owner and admins can (identity-service `moderatorOver`, the same
 * ladder as removing or silencing someone): the owner over anyone, an admin over
 * members only — never over the owner or another admin. A direct chat has no
 * moderator. The service enforces all of this; computing it here only decides
 * whether to OFFER the option, because a menu that offers what the server
 * refuses teaches people to distrust the menu.
 */
export function canModerateMessage(
  thread: Pick<Thread, 'kind' | 'role' | 'owner' | 'admins'> | null | undefined,
  sender: string | null | undefined,
): boolean {
  if (!thread || thread.kind !== 'GROUP') return false;
  if (thread.role === 'owner') return true;
  if (thread.role !== 'admin') return false;
  const by = norm(sender);
  if (!by || by === norm(thread.owner)) return false;
  return !(thread.admins ?? []).some((a) => norm(a) === by);
}
