// @vitest-environment node
//
// The front door must stay open.
//
// Connection is the ecosystem's entry point: its whole acquisition story depends
// on a visitor seeing real people BEFORE being asked to authenticate. That property
// is not enforced by any type — it is enforced by two lists in middleware.ts, and
// it was already lost once: the public directory and the public profile were built
// as public routes, but the only PAGE that rendered them lived under /app, so the
// entire surface was behind the session guard and nobody noticed.
//
// These tests pin the guard itself. Adding '/discover', '/u' or '/' to
// PROTECTED_ROUTES — or letting the redirect swallow them — closes the door again,
// silently, and that is exactly the failure this file exists to make loud.
import { describe, it, expect } from 'vitest';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

const get = (path: string) =>
  middleware(new NextRequest(`https://connection.tecosystem.app${path}`, { method: 'GET' }));

const PUBLIC  = ['/', '/discover', '/discover?q=builder', '/u/someone', '/privacy', '/terms'];
const PRIVATE = ['/app', '/settings', '/profile', '/dashboard'];

describe('public entry surfaces are reachable with NO session', () => {
  for (const path of PUBLIC) {
    it(`${path} is not redirected to login`, () => {
      const res = get(path);
      // There is no guard redirect any more. Anything else (the pass-through
      // NextResponse.next(), 200) means the request was allowed through.
      expect(res.headers.get('location')).toBeNull();
      expect(res.status).toBe(200);
    });
  }
});

describe('guarded pages are not redirected either (C-123 §11)', () => {
  // The personal graph is protected where the data is — every BFF route needs
  // the session (P6) — not by sending a session-less visit off the origin.
  for (const path of PRIVATE) {
    it(`${path} opens with no session`, () => {
      expect(get(path).headers.get('location')).toBeNull();
    });
  }
});
