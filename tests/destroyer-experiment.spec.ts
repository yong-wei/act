import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1600, height: 1000 } });

const TOTAL_STEPS = 20;

// 无头浏览器软件渲染下仿真只有实时的几分之一；逐步评分与 20 步全流程由
// destroyer-experiment-flow.test.ts 直接驱动数值内核覆盖，这里只验页面接线。
test('学生完成驱逐舰第一步后解锁下一步', async ({ page }) => {
  test.setTimeout(600000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/simulations/destroyer', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '055 型驱逐舰航向控制' })).toBeVisible();
  await expect(page.locator('[data-sim-ui] canvas').first()).toBeVisible({ timeout: 30000 });

  const result = await page.evaluate(async () => {
    const scene = document.querySelector('[data-sim-ui]');
    if (!scene) throw new Error('没有仿真界面');

    const buttonByName = (name: string, root: ParentNode = document) => {
      const found = [...root.querySelectorAll('button')].find((button) => {
        const label = (button.getAttribute('aria-label') || button.textContent || '').replace(/\s+/g, '');
        const wanted = name.replace(/\s+/g, '');
        return label === wanted || label.includes(wanted);
      });
      if (!found) throw new Error(`找不到按钮：${name}`);
      return found;
    };

    const clickName = (name: string, root?: ParentNode) => {
      buttonByName(name, root).click();
    };

    const tab = (name: string) => {
      const found = [...scene.querySelectorAll('[role="tab"]')].find((item) => item.textContent?.replace(/\s+/g, '') === name);
      if (!found) throw new Error(`找不到标签：${name}`);
      const trigger = found as HTMLElement;
      trigger.focus();
      trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    };

    const readout = (name: string) => {
      const text = scene.querySelector(`[data-destroyer-readout="${name}"]`)?.textContent ?? '';
      return Number(text.replace(/[^\d.-]/g, ''));
    };

    const series = (id: string) => scene.querySelector(`[data-destroyer-series-value="${id}"]`)?.textContent?.trim() ?? '';

    const fill = (label: string, value: string) => {
      const field = [...scene.querySelectorAll('input[aria-label], textarea[aria-label]')].find((item) => {
        return item.getAttribute('aria-label') === label && (item as HTMLInputElement).type !== 'checkbox';
      }) as HTMLInputElement | HTMLTextAreaElement | undefined;
      if (!field) throw new Error(`找不到填写框：${label}`);
      const prototype = Object.getOwnPropertyDescriptor(
        field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value',
      );
      prototype?.set?.call(field, value);
      const tracker = (field as HTMLInputElement & { _valueTracker?: { setValue: (next: string) => void } })._valueTracker;
      tracker?.setValue('');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const setRudder = async (target: number) => {
      const thumb = scene.querySelector('[data-destroyer-rudder-slider] [role="slider"]');
      if (!thumb) throw new Error('这一步没有手操舵角滑条');
      const fiberKey = Object.keys(thumb).find((key) => key.startsWith('__reactFiber$'));
      type Fiber = {
        return?: Fiber;
        memoizedProps?: { onValueChange?: (value: number[]) => void; value?: number[] };
      };
      let fiber = fiberKey ? (thumb as unknown as Record<string, Fiber>)[fiberKey] : undefined;
      let change: ((value: number[]) => void) | undefined;
      while (fiber) {
        const props = fiber.memoizedProps;
        if (typeof props?.onValueChange === 'function' && Array.isArray(props.value)) {
          change = props.onValueChange;
          break;
        }
        fiber = fiber.return;
      }
      if (!change) throw new Error('手操舵角滑条不能拖动');
      change([target]);
      await waitUntil(
        () => Math.round(Number(thumb.getAttribute('aria-valuenow'))) === target,
        `手操舵角没有到 ${target}°`,
        5000,
      );
    };

    const frame = () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const waitUntil = async (predicate: () => boolean, label: string | (() => string), timeoutMs = 1200000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeoutMs) throw new Error(typeof label === 'function' ? label() : label);
        await frame();
      }
    };

    const showStatus = async () => {
      tab('状态');
      const tabStates = () => [...scene.querySelectorAll('[role="tab"]')]
        .map((item) => `${item.textContent?.trim()}:${item.getAttribute('data-state')}`)
        .join(',');
      await waitUntil(
        () => {
          if (scene.querySelector('[data-destroyer-readout="time"]')) return true;
          tab('状态');
          return false;
        },
        () => `状态没有显示（${tabStates()}；${scene.querySelector('[data-destroyer-step-state="current"]')?.textContent ?? ''}）`,
        5000,
      );
    };

    const invokeClick = (node: Element | null | undefined) => {
      if (!node) throw new Error('找不到可点击的控件');
      const propsKey = Object.keys(node).find((key) => key.startsWith('__reactProps$'));
      const props = propsKey ? (node as unknown as Record<string, { onClick?: () => void }>)[propsKey] : undefined;
      if (props?.onClick) props.onClick();
      else (node as HTMLElement).click();
    };

    const runUntil = async (seconds: number, watch?: () => void) => {
      await showStatus();
      invokeClick(scene.querySelector('[data-sound-start]'));
      await waitUntil(() => {
        watch?.();
        return readout('time') >= seconds;
      }, `仿真没有跑到 ${seconds} 秒`);
      invokeClick(buttonByName('暂停', scene));
      await frame();
    };

    const submit = async (seq: number, expectTitle: string) => {
      clickName('提交本步', scene);
      await frame();
      const message = scene.querySelector('[data-destroyer-message]')?.textContent?.trim() ?? '';
      if (!message.includes('本步已记录') && !message.includes('报告已在本机生成')) {
        throw new Error(`第 ${seq} 步没有通过。提示：${message}`);
      }
      tab('实验步骤');
      await waitUntil(
        () => scene.querySelector(`[data-destroyer-step="${seq + 1}"]`)?.getAttribute('data-destroyer-step-state') === 'current',
        '步骤状态没有刷新',
        5000,
      );
      const current = scene.querySelector(`[data-destroyer-step="${seq + 1}"]`)?.getAttribute('data-destroyer-step-state');
      const ahead = scene.querySelector<HTMLButtonElement>(`[data-destroyer-step="${seq + 2}"]`)?.disabled ?? null;
      tab('状态');
      await waitUntil(
        () => (scene.textContent ?? '').includes(expectTitle),
        `提交后没有进入「${expectTitle}」。提示：${message}`,
      );
      return { seq, message, current, ahead };
    };

    const left = scene.querySelector('[data-simulation-local-panel="left"]');
    const right = scene.querySelector('[data-simulation-local-panel="right"]');
    const leftWidth = left ? Number.parseFloat(getComputedStyle(left).width) : 0;
    const rightWidth = right ? Number.parseFloat(getComputedStyle(right).width) : 0;
    const statusTab = [...scene.querySelectorAll('[role="tab"]')].find((item) => item.textContent?.includes('状态'));
    const statusActive = statusTab?.getAttribute('data-state') === 'active';
    const manualBox = scene.querySelector<HTMLInputElement>('input[aria-label="手操舵角"]');
    const trackBox = scene.querySelector<HTMLInputElement>('input[aria-label="航迹误差"]');
    if (!manualBox || !trackBox) throw new Error('曲线勾选没有显示出来');
    manualBox.click();
    const manualOff = !manualBox.checked;
    manualBox.click();

    tab('实验步骤');
    await waitUntil(
      () => scene.querySelector('[data-destroyer-step="1"]')?.getAttribute('data-destroyer-step-state') === 'current',
      '实验步骤没有显示',
      5000,
    );
    const step1 = scene.querySelector('[data-destroyer-step="1"]')?.getAttribute('data-destroyer-step-state');
    const step2Disabled = scene.querySelector<HTMLButtonElement>('[data-destroyer-step="2"]')?.disabled ?? false;
    const suggestion = scene.querySelector('[data-destroyer-suggestion]')?.textContent ?? '';
    clickName('问控灵这一步', scene);
    await waitUntil(() => {
      const sidebar = document.querySelector('[data-global-ai-sidebar="open"]');
      return Boolean(sidebar?.textContent?.includes('直航读数'));
    }, '控灵没有显示当前步骤', 15000);
    clickName('关闭 AI 侧栏');
    await waitUntil(() => !document.querySelector('[data-global-ai-sidebar="open"]'), '控灵侧栏没有关闭', 5000);
    // 侧栏关闭后会把焦点还给打开前的「实验步骤」标签，焦点即激活，需等焦点归还后再切回状态。
    await new Promise<void>((resolve) => { setTimeout(resolve, 300); });
    tab('状态');

    const manualDisabled = buttonByName('manual', scene).disabled;
    const pidEnabled = !buttonByName('pid', scene).disabled;
    const rateButton = scene.querySelector<HTMLButtonElement>('[data-chrome-popover-trigger="rate"]');
    if (!rateButton) throw new Error('找不到速率');
    const speedLabel = (rateButton.textContent ?? '').includes('8.0x');

    await runUntil(20);
    fill('实际航向', series('actualHeading'));
    fill('航速', series('speed'));
    const steps = [await submit(1, '2. 手操打舵')];

    await setRudder(15);
    const rudderReady = Math.round(Number(
      scene.querySelector('[data-destroyer-rudder-slider] [role="slider"]')?.getAttribute('aria-valuenow'),
    )) === 15;

    tab('实验步骤');
    await waitUntil(() => scene.querySelectorAll('[data-destroyer-step]').length > 0, '实验步骤列表没有显示', 5000);
    const stepButtons = [...scene.querySelectorAll('[data-destroyer-step]')];
    const lastStepText = stepButtons.at(-1)?.textContent ?? '';
    const reportHidden = !scene.querySelector('[data-destroyer-report]');
    tab('状态');

    return {
      leftWidth,
      rightWidth,
      statusActive,
      manualOff,
      manualOn: manualBox.checked,
      trackOff: !trackBox.checked,
      step1,
      step2Disabled,
      suggestion,
      manualDisabled,
      pidEnabled,
      speedLabel,
      stepCount: stepButtons.length,
      lastStepText,
      reportHidden,
      rudderReady,
      steps,
    };
  });

  expect(result.leftWidth).toBeGreaterThan(160);
  expect(result.leftWidth).toBeLessThan(900);
  expect(result.rightWidth).toBeGreaterThan(160);
  expect(result.rightWidth).toBeLessThan(900);
  expect(Math.round(result.leftWidth)).not.toBe(320);
  expect(Math.round(result.rightWidth)).not.toBe(352);
  expect(result.statusActive).toBe(true);
  expect(result.manualOff).toBe(true);
  expect(result.manualOn).toBe(true);
  expect(result.trackOff).toBe(true);
  expect(result.step1).toBe('current');
  expect(result.step2Disabled).toBe(true);
  expect(result.suggestion).toContain('不要改增益');
  expect(result.manualDisabled).toBe(true);
  expect(result.pidEnabled).toBe(true);
  expect(result.speedLabel).toBe(true);
  expect(result.stepCount).toBe(TOTAL_STEPS);
  expect(result.lastStepText).toContain(`${TOTAL_STEPS}. 确认报告`);
  expect(result.reportHidden).toBe(true);

  expect(result.rudderReady).toBe(true);
  expect(result.steps).toHaveLength(1);
  for (const step of result.steps) {
    expect(step.message, JSON.stringify(step)).toContain('本步已记录');
    expect(step.current, JSON.stringify(step)).toBe('current');
    expect(step.ahead, JSON.stringify(step)).toBe(true);
  }

  expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
});

test('进入实验后默认八倍速，并说明可以重做和查看报告', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/simulations/destroyer', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-sim-ui] canvas').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-sim-ui] [data-chrome-popover-trigger="rate"]')).toContainText('8.0x');

  const text = await page.evaluate(async () => {
    const scene = document.querySelector('[data-sim-ui]');
    if (!scene) throw new Error('没有仿真界面');
    const openTab = (name: string) => {
      const tab = [...scene.querySelectorAll('[role="tab"]')].find((item) => item.textContent?.includes(name));
      if (!(tab instanceof HTMLElement)) throw new Error(`找不到${name}`);
      tab.focus();
      tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    };
    openTab('实验步骤');
    openTab('评估');
    await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
    return {
      steps: scene.querySelector('[data-destroyer-step-nav]')?.textContent ?? '',
      step2Disabled: scene.querySelector<HTMLButtonElement>('[data-destroyer-step="2"]')?.disabled ?? false,
      history: scene.querySelector('[data-destroyer-report-history]')?.textContent ?? '',
    };
  });

  expect(text.steps).toContain('可以回去重做');
  expect(text.step2Disabled).toBe(true);
  expect(text.history).toContain('登录后可以查看');
});
