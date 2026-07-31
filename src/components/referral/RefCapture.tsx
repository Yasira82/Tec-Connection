'use client';

import { useEffect } from 'react';
import { captureRef } from '@/lib-client/referral';

/**
 * Global, render-nothing capture of an incoming `?ref=CODE` from an invite link.
 * Mounted once at the client boundary so it runs on EVERY page — public landing,
 * pioneers, anywhere — before the visitor has even logged in. Reads
 * window.location.search directly (no useSearchParams → no Suspense needed).
 */
export function RefCapture() {
  useEffect(() => {
    captureRef(window.location.search);
  }, []);
  return null;
}
