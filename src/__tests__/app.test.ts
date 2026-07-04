import { describe, it, expect } from 'vitest';
import { isHubNavigation } from '@/lib/pi-payment';

describe('TEC Connection — health', () => {
  it('environment is configured', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });

  it('isHubNavigation degrades safely (no hub referrer)', () => {
    // Without a hub.tecosystem.app referrer the ADR-007 guard must not throw and
    // must default to false (so Mode-2 is only ever chosen deliberately).
    expect(isHubNavigation()).toBe(false);
  });
});
