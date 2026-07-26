'use client';

import type { ComponentProps, MouseEvent } from 'react';
import Link from 'next/link';

export const TEXTBOOK_MODAL_SESSION_KEY = 'act:textbook-reader-modal-session';
const TEXTBOOK_MODAL_HISTORY_KEY = '__actTextbookModalSession';

interface TextbookModalSession {
  sourceHref: string;
  depth: number;
}

function isPlainInternalClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0
    && !event.defaultPrevented
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && event.currentTarget.target !== '_blank';
}

function currentHref(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function validatedModalSession(
  candidate: Partial<TextbookModalSession> | null | undefined,
): TextbookModalSession | null {
  if (
    !candidate
    || typeof candidate.sourceHref !== 'string'
    || !candidate.sourceHref.startsWith('/')
    || candidate.sourceHref.startsWith('//')
    || !Number.isInteger(candidate.depth)
    || (candidate.depth ?? 0) < 1
    || (candidate.depth ?? 0) > 50
  ) return null;
  return { sourceHref: candidate.sourceHref, depth: candidate.depth! };
}

function readPendingModalSession(): TextbookModalSession | null {
  try {
    return validatedModalSession(
      JSON.parse(sessionStorage.getItem(TEXTBOOK_MODAL_SESSION_KEY) ?? 'null') as
        Partial<TextbookModalSession> | null,
    );
  } catch {
    return null;
  }
}

function readHistoryModalSession(): TextbookModalSession | null {
  if (!window.history.state || typeof window.history.state !== 'object') return null;
  return validatedModalSession(
    (window.history.state as Record<string, unknown>)[
      TEXTBOOK_MODAL_HISTORY_KEY
    ] as Partial<TextbookModalSession> | null,
  );
}

function readModalSession(): TextbookModalSession | null {
  return readHistoryModalSession() ?? readPendingModalSession();
}

function writeModalSession(session: TextbookModalSession): void {
  sessionStorage.setItem(TEXTBOOK_MODAL_SESSION_KEY, JSON.stringify(session));
}

type ReaderLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };
type FragmentLinkProps = Omit<ComponentProps<'a'>, 'href'> & { href: string };

export function TextbookReaderLink({ href, onClick, ...props }: ReaderLinkProps) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!isPlainInternalClick(event)) return;
        writeModalSession({ sourceHref: currentHref(), depth: 1 });
      }}
      {...props}
    />
  );
}

export function TextbookReaderNavigationLink({ href, onClick, ...props }: ReaderLinkProps) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!isPlainInternalClick(event)) return;
        if (!document.querySelector('[data-textbook-reader-modal="true"]')) return;
        const session = readModalSession();
        if (session) writeModalSession({ ...session, depth: session.depth + 1 });
      }}
      {...props}
    />
  );
}

export function TextbookReaderFragmentLink({
  href,
  onClick,
  ...props
}: FragmentLinkProps) {
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!isPlainInternalClick(event)) return;
        event.preventDefault();
        const oldURL = window.location.href;
        const newURL = new URL(href, oldURL).href;
        window.history.replaceState(window.history.state, '', newURL);
        window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }));
      }}
      {...props}
    />
  );
}

export function consumeTextbookModalSession(): TextbookModalSession | null {
  const session = readModalSession();
  sessionStorage.removeItem(TEXTBOOK_MODAL_SESSION_KEY);
  return session;
}

export function persistTextbookModalSessionInHistory(): void {
  const session = readPendingModalSession();
  if (!session) return;
  window.history.replaceState({
    ...(window.history.state ?? {}),
    [TEXTBOOK_MODAL_HISTORY_KEY]: session,
  }, '');
  sessionStorage.removeItem(TEXTBOOK_MODAL_SESSION_KEY);
}
