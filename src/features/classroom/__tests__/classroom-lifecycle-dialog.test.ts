import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  requestClassroomConflictChoice,
  requestClassroomEndConfirmation,
} from '@/features/classroom/classroom-lifecycle-dialog';

class MiniKeyboardEvent {
  defaultPrevented = false;

  constructor(
    public readonly type: string,
    public readonly init: { key?: string; shiftKey?: boolean } = {},
  ) {}

  get key() {
    return this.init.key ?? '';
  }

  get shiftKey() {
    return this.init.shiftKey === true;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }
}

class MiniElement {
  children: MiniElement[] = [];
  parentElement: MiniElement | null = null;
  textContent = '';
  className = '';
  id = '';
  tabIndex = 0;
  type = '';
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Array<(event: MiniKeyboardEvent) => void>>();

  constructor(
    public readonly tagName: string,
    private readonly documentRef: MiniDocument,
  ) {}

  get isConnected() {
    return this === this.documentRef.body || this.parentElement?.isConnected === true;
  }

  get offsetParent() {
    return this.isConnected ? this.parentElement ?? this.documentRef.body : null;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === 'id') this.id = value;
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  appendChild(child: MiniElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  contains(candidate: MiniElement | null) {
    if (!candidate) return false;
    if (candidate === this) return true;
    return this.children.some((child) => child.contains(candidate));
  }

  querySelectorAll<T extends MiniElement = MiniElement>(selector: string): T[] {
    const results: MiniElement[] = [];
    const visit = (node: MiniElement) => {
      for (const child of node.children) {
        if (selector.includes('button') && child.tagName === 'button' && !child.hasAttribute('disabled')) {
          results.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return results as T[];
  }

  addEventListener(type: string, listener: (event: MiniKeyboardEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatchEvent(event: MiniKeyboardEvent) {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    return !event.defaultPrevented;
  }

  focus() {
    this.documentRef.activeElement = this;
  }

  click() {
    for (const listener of this.listeners.get('click') ?? []) listener(new MiniKeyboardEvent('click'));
  }
}

class MiniDocument {
  readonly body = new MiniElement('body', this);
  activeElement: MiniElement | null = null;

  createElement(tagName: string) {
    return new MiniElement(tagName, this);
  }

  querySelector(selector: string) {
    return this.body.querySelectorAll(selector)[0] ?? null;
  }
}

function installMiniDom() {
  const document = new MiniDocument();
  const window = {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  };
  vi.stubGlobal('HTMLElement', MiniElement);
  vi.stubGlobal('KeyboardEvent', MiniKeyboardEvent);
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  return document;
}

function lifecycleDialog(document: MiniDocument) {
  return document.body.children.find((child) => child.getAttribute('data-classroom-lifecycle-dialog'));
}

describe('classroom lifecycle dialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves conflict choices and removes the overlay', async () => {
    const document = installMiniDom();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const choice = requestClassroomConflictChoice({
      identity: { lessonTitle: '测试课堂', className: '一班', sessionId: 'session-1' },
    });
    const overlay = lifecycleDialog(document);
    expect(overlay?.getAttribute('data-classroom-lifecycle-dialog')).toBe('active-conflict');
    expect(overlay?.children[0]?.getAttribute('role')).toBe('dialog');
    expect(overlay?.children[0]?.getAttribute('aria-modal')).toBe('true');

    const buttons = overlay?.querySelectorAll('button') ?? [];
    expect(buttons.map((button) => button.textContent)).toEqual(['取消', '进入已有课堂', '仍然新开']);
    buttons[1].click();

    await expect(choice).resolves.toBe('reuse');
    expect(lifecycleDialog(document)).toBeUndefined();
    expect(document.activeElement).toBe(opener);
  });

  it('cancels on Escape and restores focus', async () => {
    const document = installMiniDom();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const choice = requestClassroomConflictChoice({ identity: { lessonTitle: '测试课堂' } });
    const overlay = lifecycleDialog(document);
    const event = new MiniKeyboardEvent('keydown', { key: 'Escape' });
    overlay?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await expect(choice).resolves.toBe('cancel');
    expect(lifecycleDialog(document)).toBeUndefined();
    expect(document.activeElement).toBe(opener);
  });

  it('traps Tab focus inside the dialog', () => {
    const document = installMiniDom();

    void requestClassroomConflictChoice({ identity: { lessonTitle: '测试课堂' } });
    const overlay = lifecycleDialog(document);
    const buttons = overlay?.querySelectorAll('button') ?? [];
    buttons[2].focus();

    const tabEvent = new MiniKeyboardEvent('keydown', { key: 'Tab' });
    overlay?.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);

    const shiftTabEvent = new MiniKeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
    overlay?.dispatchEvent(shiftTabEvent);
    expect(shiftTabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('resolves destructive end confirmations through the confirm button', async () => {
    const document = installMiniDom();

    const confirmed = requestClassroomEndConfirmation(['影响：学生端结束']);
    const overlay = lifecycleDialog(document);
    expect(overlay?.getAttribute('data-classroom-lifecycle-dialog')).toBe('end-classroom');

    const buttons = overlay?.querySelectorAll('button') ?? [];
    expect(buttons.map((button) => button.textContent)).toEqual(['取消', '确认结束']);
    buttons[1].click();

    await expect(confirmed).resolves.toBe(true);
    expect(lifecycleDialog(document)).toBeUndefined();
  });
});
