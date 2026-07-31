'use client';

import { useEffect, useRef } from 'react';
import { usePiAuth } from '@yasser172/tec-auth';
import { getPendingRef, clearPendingRef, applyReferral } from '@/lib-client/referral';

/**
 * Render-nothing applier. Once the visitor is authenticated (via Hub SSO), if a
 * referral code was captured earlier from an invite link (?ref=CODE on any page),
 * apply it to their account and clear it. This closes the growth loop for someone
 * who opened an invite link to THIS app and only logged in later — the reward is
 * attributed platform-side (commerce-service) without them visiting a referral page.
 */
export function RefApply() {
  const { isAuthenticated, isLoading } = usePiAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || ran.current) return;
    const code = getPendingRef();
    if (!code) return;
    ran.current = true; // one attempt per mount; never loop
    applyReferral(code).then((result) => {
      // 'applied' or 'consumed' → done; 'retry' → keep for a later session.
      if (result !== 'retry') clearPendingRef();
    });
  }, [isAuthenticated, isLoading]);

  return null;
}
