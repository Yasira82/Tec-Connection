import { describe, it, expect } from 'vitest';
import { canModerateMessage } from '@/lib-client/connection/moderation';

// Whether "Delete for everyone" is OFFERED on someone else's message. Mirrors
// identity-service's moderatorOver; the service is still the one that decides.
const group = (role: 'owner' | 'admin' | 'member') =>
  ({ kind: 'GROUP' as const, role, owner: 'Boss', admins: ['Mod', 'mod2'] });

describe('canModerateMessage', () => {
  it('the owner can clear anyone’s message', () => {
    expect(canModerateMessage(group('owner'), 'bob')).toBe(true);
    expect(canModerateMessage(group('owner'), 'mod')).toBe(true);
  });

  it('an admin can clear a member’s message', () => {
    expect(canModerateMessage(group('admin'), 'bob')).toBe(true);
  });

  it('an admin cannot clear the owner’s or another admin’s — in any case', () => {
    expect(canModerateMessage(group('admin'), 'boss')).toBe(false);
    expect(canModerateMessage(group('admin'), '@MOD2')).toBe(false);
  });

  it('a member cannot, and a direct chat has no moderator', () => {
    expect(canModerateMessage(group('member'), 'bob')).toBe(false);
    expect(canModerateMessage({ kind: 'DIRECT', role: 'owner', owner: null, admins: [] }, 'bob')).toBe(false);
    expect(canModerateMessage(null, 'bob')).toBe(false);
  });
});
