'use client';

import { useEffect } from 'react';

/** Restore heading hash after hydration; native hash scroll is lost when React replaces the SSR tree. */
export function HandoutHashScroll() {
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    let headingId = raw;
    try {
      headingId = decodeURIComponent(raw);
    } catch {
      headingId = raw;
    }
    const element = document.getElementById(headingId);
    element?.scrollIntoView({ block: 'start' });
  }, []);
  return null;
}
