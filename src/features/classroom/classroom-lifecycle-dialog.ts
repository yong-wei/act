'use client';

export type ClassroomConflictChoice = 'reuse' | 'new-session' | 'cancel';

export interface ClassroomConflictIdentity {
  summaryLabel?: string | null;
  label?: string | null;
  lessonTitle?: string | null;
  className?: string | null;
  sessionId?: string | null;
}

interface DialogAction<T extends string> {
  value: T;
  label: string;
  tone?: 'primary' | 'danger' | 'secondary';
}

interface DialogRequest<T extends string> {
  title: string;
  description: string;
  details?: string[];
  actions: DialogAction<T>[];
  cancelValue: T;
  dataState: string;
}

const dialogFocusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function actionClassName(tone: DialogAction<string>['tone']) {
  if (tone === 'danger') {
    return 'rounded-lg bg-platform-evidence-unsupported px-4 py-2 text-sm font-medium text-platform-fg-inverse transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-platform-action-primary';
  }
  if (tone === 'primary') {
    return 'rounded-lg bg-platform-action-primary px-4 py-2 text-sm font-medium text-platform-fg-inverse transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-platform-action-primary';
  }
  return 'rounded-lg border border-platform-border bg-platform-surface px-4 py-2 text-sm font-medium text-platform-fg-primary transition hover:bg-platform-action-hover focus:outline-none focus:ring-2 focus:ring-platform-action-primary';
}

function appendText<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tagName: K,
  text: string,
  className?: string,
) {
  const node = document.createElement(tagName);
  node.textContent = text;
  if (className) node.className = className;
  parent.appendChild(node);
  return node;
}

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(dialogFocusableSelector))
    .filter((item) => !item.hasAttribute('disabled') && item.offsetParent !== null);
}

function requestClassroomDialog<T extends string>({
  title,
  description,
  details = [],
  actions,
  cancelValue,
  dataState,
}: DialogRequest<T>): Promise<T> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(cancelValue);
  }

  return new Promise<T>((resolve) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[80] flex items-center justify-center bg-platform-canvas/72 px-4 backdrop-blur-sm';
    overlay.setAttribute('data-classroom-lifecycle-dialog', dataState);

    const dialog = document.createElement('section');
    dialog.className = 'w-full max-w-md rounded-xl border border-platform-border-strong bg-platform-surface-overlay p-6 text-platform-fg-primary shadow-2xl';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;

    const titleId = `classroom-lifecycle-title-${Math.random().toString(36).slice(2)}`;
    const descId = `classroom-lifecycle-desc-${Math.random().toString(36).slice(2)}`;
    const titleNode = appendText(dialog, 'h2', title, 'text-lg font-semibold text-platform-fg-primary');
    titleNode.id = titleId;
    const descNode = appendText(dialog, 'p', description, 'mt-2 text-sm leading-6 text-platform-fg-secondary');
    descNode.id = descId;
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.setAttribute('aria-describedby', descId);

    if (details.length) {
      const list = document.createElement('ul');
      list.className = 'mt-4 space-y-2 rounded-lg border border-platform-border bg-platform-canvas-muted p-3 text-sm text-platform-fg-secondary';
      for (const detail of details) {
        appendText(list, 'li', detail);
      }
      dialog.appendChild(list);
    }

    const footer = document.createElement('div');
    footer.className = 'mt-6 flex flex-wrap justify-end gap-3';

    const close = (value: T) => {
      overlay.remove();
      window.requestAnimationFrame(() => {
        if (opener?.isConnected && opener.offsetParent !== null) opener.focus();
      });
      resolve(value);
    };

    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.className = actionClassName(action.tone);
      button.addEventListener('click', () => close(action.value));
      footer.appendChild(button);
    }

    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(cancelValue);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    overlay.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => {
      getFocusableElements(dialog)[0]?.focus() ?? dialog.focus();
    });
  });
}

export function requestClassroomConflictChoice({
  identity,
  message,
}: {
  identity?: ClassroomConflictIdentity | null;
  message?: string | null;
}) {
  const summary = identity?.summaryLabel || identity?.label || identity?.lessonTitle || '当前课堂';
  const details = [
    `课堂身份：${summary}`,
    identity?.className ? `绑定班级：${identity.className}` : '课堂类型：临时课堂或课程入口课堂',
    identity?.sessionId ? `已有会话：${identity.sessionId}` : '',
  ].filter(Boolean);

  return requestClassroomDialog<ClassroomConflictChoice>({
    title: '已有进行中的课堂',
    description: message || '检测到同一课堂上下文已有进行中的会话，请选择进入已有课堂、仍然新开，或取消本次操作。',
    details,
    dataState: 'active-conflict',
    cancelValue: 'cancel',
    actions: [
      { value: 'cancel', label: '取消', tone: 'secondary' },
      { value: 'reuse', label: '进入已有课堂', tone: 'secondary' },
      { value: 'new-session', label: '仍然新开', tone: 'primary' },
    ],
  });
}

export function requestClassroomActionConfirmation({
  title,
  description,
  details,
  confirmLabel = '确认',
  dataState = 'action-confirmation',
}: {
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  dataState?: string;
}) {
  return requestClassroomDialog<'confirm' | 'cancel'>({
    title,
    description,
    details,
    dataState,
    cancelValue: 'cancel',
    actions: [
      { value: 'cancel', label: '取消', tone: 'secondary' },
      { value: 'confirm', label: confirmLabel, tone: 'danger' },
    ],
  }).then((choice) => choice === 'confirm');
}

export function requestClassroomEndConfirmation(details?: string[]) {
  return requestClassroomActionConfirmation({
    title: '结束课堂',
    description: '结束后学生将停止同步课堂进度，课堂提交和互动日志会进入结束态。',
    details: details?.length ? details : ['学生端进入课堂结束态', '教师端返回复盘或课堂历史入口', '课堂证据进入后续物化链路'],
    confirmLabel: '确认结束',
    dataState: 'end-classroom',
  });
}
