'use client';

import { useEffect, useRef, useState } from 'react';

export function TextbookFragmentFocus({
  availableFragments,
  children,
}: {
  availableFragments: string[];
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [locationState, setLocationState] = useState<'none' | 'focused' | 'missing'>('none');

  useEffect(() => {
    const focusFragment = () => {
      const encodedFragment = window.location.hash.slice(1);
      if (!encodedFragment) {
        setLocationState('none');
        return;
      }
      let fragment = encodedFragment;
      try {
        fragment = decodeURIComponent(encodedFragment);
      } catch {
        setLocationState('missing');
        return;
      }
      if (!availableFragments.includes(fragment)) {
        setLocationState('missing');
        return;
      }
      const marker = rootRef.current?.querySelector<HTMLElement>(`[id="${CSS.escape(fragment)}"]`);
      if (!marker) {
        setLocationState('missing');
        return;
      }

      rootRef.current
        ?.querySelectorAll<HTMLElement>('[data-textbook-fragment-target="true"]')
        .forEach((element) => {
          delete element.dataset.textbookFragmentTarget;
          element.removeAttribute('tabindex');
        });
      const markerContainer = marker.parentElement;
      const target = markerContainer?.textContent?.trim()
        ? markerContainer
        : markerContainer?.nextElementSibling instanceof HTMLElement
          ? markerContainer.nextElementSibling
          : markerContainer;
      if (!target) {
        setLocationState('missing');
        return;
      }
      target.dataset.textbookFragmentTarget = 'true';
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setLocationState('focused');
    };

    focusFragment();
    window.addEventListener('hashchange', focusFragment);
    return () => window.removeEventListener('hashchange', focusFragment);
  }, [availableFragments]);

  return (
    <div ref={rootRef}>
      {locationState === 'missing' ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
          data-textbook-fragment-unavailable="true"
        >
          当前单元可正常阅读，但请求的公式、插图或表格位置不可用。
        </div>
      ) : null}
      <div
        className="[&_[data-textbook-fragment-target=true]]:rounded-lg [&_[data-textbook-fragment-target=true]]:outline [&_[data-textbook-fragment-target=true]]:outline-2 [&_[data-textbook-fragment-target=true]]:outline-offset-4 [&_[data-textbook-fragment-target=true]]:outline-sky-500"
        data-textbook-fragment-state={locationState}
      >
        {children}
      </div>
    </div>
  );
}
