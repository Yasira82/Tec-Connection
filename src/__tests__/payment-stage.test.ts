import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createU2APayment, type PaymentStage } from '@/lib/pi-payment';
import { piSession } from '@/lib/pi/pi-session';

/**
 * A Mode-2 payment that stalls inside the Pi SDK reaches NO server: no Vercel
 * request, no payment-service log. On 2026-09-06 one sat on "Confirm in Pi…"
 * until the owner navigated away, and the logs could prove only that
 * `/api/bff/payment/approve` had never been called — not whether it had died in
 * `Pi.authenticate` or in `Pi.createPayment`, because one label covered both.
 *
 * These tests pin the thing that answers that question.
 */

type Callbacks = {
  onReadyForServerApproval:   (id: string) => void;
  onReadyForServerCompletion: (id: string, txid: string) => void;
  onCancel: () => void;
  onError:  (err?: unknown) => void;
};

let stages: PaymentStage[];
let captured: Callbacks | null;

const pay = (onStage?: (s: PaymentStage) => void) =>
  createU2APayment(5, 'memo', { item_id: 'x' }, 'internal-1', onStage ?? ((s) => stages.push(s)));

beforeEach(() => {
  vi.useFakeTimers();
  stages   = [];
  captured = null;
  // The Pi session is now module state shared by the warm-up and the tap (it
  // exists so the two can never run two concurrent Pi.authenticate calls).
  // Module state survives between tests: without this, the first case leaves
  // the session authenticated and every later case skips the handshake, so the
  // stage sequence under test never happens. Reset it, do not weaken the
  // assertions — the sequence is the contract.
  piSession.reset();
  // A 201 for approve/complete — these tests are about the SDK half.
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).document = { cookie: '' };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (globalThis as Record<string, unknown>).Pi;
});

const installPi = (opts: {
  authenticate?: () => Promise<unknown>;
  createPayment?: (data: unknown, cbs: Callbacks) => void;
}) => {
  (globalThis as Record<string, unknown>).Pi = {
    authenticate:  opts.authenticate  ?? (async () => ({})),
    createPayment: opts.createPayment ?? ((_d: unknown, cbs: Callbacks) => { captured = cbs; }),
  };
};

describe('a stalled payment says WHERE it stalled', () => {
  it('names `authenticating` when Pi.authenticate never comes back', async () => {
    // The exact shape of the 2026-09-06 stall, if it was the auth half: a
    // promise that neither resolves nor rejects.
    installPi({ authenticate: () => new Promise(() => {}) });

    const p = pay();
    await vi.advanceTimersByTimeAsync(90_000);
    const result = await p;

    expect(result.status).toBe('error');
    expect(result.stage).toBe('authenticating');
    // It never got past auth — so `opening_pi` must NOT appear. Without this the
    // test would still pass if every stage were reported at once.
    expect(stages).toEqual(['authenticating']);
  });

  it('names `opening_pi` when the SDK opens but never calls back', async () => {
    // The other half, and the one the logs could not distinguish: auth is fine,
    // `createPayment` is called, and no callback ever fires.
    installPi({});

    const p = pay();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(90_000);
    const result = await p;

    expect(result.status).toBe('error');
    expect(result.stage).toBe('opening_pi');
    expect(stages).toEqual(['authenticating', 'authenticated', 'opening_pi']);
  });

  it('carries the stage on a SUCCESS too, not only on failures', async () => {
    installPi({});
    const p = pay();
    await vi.advanceTimersByTimeAsync(0);

    captured!.onReadyForServerApproval('pi-1');
    await vi.advanceTimersByTimeAsync(0);
    captured!.onReadyForServerCompletion('pi-1', 'tx-1');
    const result = await p;

    expect(result.status).toBe('completed');
    expect(result.stage).toBe('completing');
    expect(stages).toEqual([
      'authenticating', 'authenticated', 'opening_pi', 'approving', 'approved', 'completing',
    ]);
  });

  it('names `approving` when our own approve call is what hangs', async () => {
    // Distinguishes "Pi never answered" from "our backend never answered" —
    // the second is the one a missing PI_API_KEY_<APP>_TESTNET would cause.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    installPi({});

    const p = pay();
    await vi.advanceTimersByTimeAsync(0);
    captured!.onReadyForServerApproval('pi-1');
    await vi.advanceTimersByTimeAsync(90_000);
    const result = await p;

    expect(result.stage).toBe('approving');
  });
});

describe('the reporting cannot break the payment', () => {
  it('survives an onError that hands back no Error object', async () => {
    // Reading `.message` off `undefined` used to throw INSIDE the SDK callback,
    // where nothing catches it — turning a reported error into a silent hang to
    // the 90s timeout: the very failure this file exists to end.
    installPi({});
    const p = pay();
    await vi.advanceTimersByTimeAsync(0);

    expect(() => captured!.onError(undefined)).not.toThrow();
    const result = await p;

    expect(result.status).toBe('error');
    expect(result.message).toBeTruthy();
    expect(result.stage).toBe('opening_pi');
  });

  it('survives an onStage observer that throws', async () => {
    // The observer exists to watch a path that moves real Pi. A throwing watcher
    // must not become a failed purchase.
    installPi({});
    const p = pay(() => { throw new Error('observer blew up'); });
    await vi.advanceTimersByTimeAsync(0);

    captured!.onReadyForServerApproval('pi-1');
    await vi.advanceTimersByTimeAsync(0);
    captured!.onReadyForServerCompletion('pi-1', 'tx-1');

    expect((await p).status).toBe('completed');
  });
});
