import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1600, height: 1000 } });

test('学生可以走完驱逐舰航向控制的十个步骤', async ({ page }) => {
  test.setTimeout(3600000);
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

    const waitUntil = async (predicate: () => boolean, label: string, timeoutMs = 1200000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeoutMs) throw new Error(label);
        await frame();
      }
    };

    const showStatus = async () => {
      tab('状态');
      await waitUntil(
        () => Boolean(scene.querySelector('[data-destroyer-readout="time"]')),
        '状态没有显示',
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
      const expectedSeq = seq < 10 ? seq + 1 : 10;
      const expectedState = seq < 10 ? 'current' : 'done';
      await waitUntil(
        () => scene.querySelector(`[data-destroyer-step="${expectedSeq}"]`)?.getAttribute('data-destroyer-step-state') === expectedState,
        '步骤状态没有刷新',
        5000,
      );
      const current = seq < 10
        ? scene.querySelector(`[data-destroyer-step="${seq + 1}"]`)?.getAttribute('data-destroyer-step-state')
        : scene.querySelector('[data-destroyer-step="10"]')?.getAttribute('data-destroyer-step-state');
      const ahead = seq < 9
        ? scene.querySelector<HTMLButtonElement>(`[data-destroyer-step="${seq + 2}"]`)?.disabled
        : null;
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
    await frame();
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
    await runUntil(100);
    fill('手操舵角', series('manualRudder'));
    fill('转艏速率', series('yawRate'));
    steps.push(await submit(2, '3. 舵回中'));

    await setRudder(15);
    await runUntil(90);
    await setRudder(0);
    await runUntil(250);
    fill('回中后转艏速率', series('yawRate'));
    steps.push(await submit(3, '4. 小角度转向'));

    await runUntil(180);
    const peak15 = (scene.querySelector('[data-destroyer-heading-range]')?.textContent ?? '').match(/~\s*(-?[\d.]+)/)?.[1] ?? '';
    fill('航向峰值', peak15);
    steps.push(await submit(4, '5. 直角转向'));

    await runUntil(270);
    const peak90 = (scene.querySelector('[data-destroyer-heading-range]')?.textContent ?? '').match(/~\s*(-?[\d.]+)/)?.[1] ?? '';
    fill('航向峰值', peak90);
    steps.push(await submit(5, '6. 反向直角'));

    await runUntil(260);
    const endHeading = Number(series('actualHeading'));
    fill('距 -90° 的偏差', Math.abs(endHeading - (-90)).toFixed(1));
    steps.push(await submit(6, '7. 连续变向'));

    const recordedRudderPeak = () => {
      const node = scene.querySelector('[data-destroyer-series]');
      if (!node) return 0;
      const fiberKey = Object.keys(node).find((key) => key.startsWith('__reactFiber$'));
      type Fiber = { return?: Fiber; memoizedProps?: { samples?: Array<{ rudder?: number }> } };
      let fiber = fiberKey ? (node as unknown as Record<string, Fiber>)[fiberKey] : undefined;
      while (fiber) {
        const samples = fiber.memoizedProps?.samples;
        if (Array.isArray(samples) && samples.some((sample) => typeof sample?.rudder === 'number')) {
          return samples.reduce((best, sample) => Math.max(best, Math.abs(sample.rudder ?? 0)), 0);
        }
        fiber = fiber.return;
      }
      return 0;
    };
    let maxRudder = 0;
    await runUntil(590, () => {
      maxRudder = Math.max(maxRudder, recordedRudderPeak());
    });
    maxRudder = Math.max(maxRudder, recordedRudderPeak());
    clickName(maxRudder >= 34 ? '顶满了' : '没有顶满', scene);
    clickName('提交本步', scene);
    await frame();
    const saturationHint = scene.querySelector('[data-destroyer-message]')?.textContent ?? '';
    if (saturationHint.includes('请改选')) {
      clickName(saturationHint.includes('已经顶到') ? '顶满了' : '没有顶满', scene);
      steps.push(await submit(7, '8. 定常回转'));
    } else if (!saturationHint.includes('本步已记录')) {
      throw new Error(`第 7 步没有通过。记录到的最大舵角 ${maxRudder}。提示：${saturationHint}`);
    } else {
      tab('实验步骤');
      await waitUntil(
        () => scene.querySelector('[data-destroyer-step="8"]')?.getAttribute('data-destroyer-step-state') === 'current',
        '步骤状态没有刷新',
        5000,
      );
      const current = scene.querySelector('[data-destroyer-step="8"]')?.getAttribute('data-destroyer-step-state');
      const ahead = scene.querySelector<HTMLButtonElement>('[data-destroyer-step="9"]')?.disabled ?? false;
      tab('状态');
      await waitUntil(() => (scene.textContent ?? '').includes('8. 定常回转'), '提交后没有进入定常回转');
      steps.push({ seq: 7, message: saturationHint.trim(), current, ahead });
    }

    await runUntil(240);
    fill('末段转艏速率', series('yawRate'));
    fill('末段舵角', series('rudder'));
    steps.push(await submit(8, '9. 扰动直航'));

    await runUntil(150);
    const range = scene.querySelector('[data-destroyer-heading-range]')?.textContent ?? '';
    const deviation = Math.max(...[...range.matchAll(/(-?[\d.]+)°/g)].map((item) => Math.abs(Number(item[1]))));
    fill('最大航向偏离', deviation.toFixed(1));
    steps.push(await submit(9, '10. 确认报告'));

    const startDisabled = scene.querySelector<HTMLButtonElement>('[data-sound-start]')?.disabled ?? false;
    const reportBefore = scene.querySelector<HTMLButtonElement>('[data-destroyer-report]')?.disabled ?? false;
    fill('操作记录', '舵角变化之后，航向和转艏速率跟着变，回中后转艏变慢。');
    steps.push(await submit(10, '10. 确认报告'));
    const reportAfter = scene.querySelector<HTMLButtonElement>('[data-destroyer-report]')?.disabled ?? true;

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
      startDisabled,
      reportBefore,
      reportAfter,
      rudderPeak: maxRudder,
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
  console.log(`recorded rudder peak ${result.rudderPeak}`);
  expect(result.startDisabled).toBe(true);
  expect(result.reportBefore).toBe(true);

  for (const step of result.steps) {
    if (step.seq < 10) {
      expect(step.message, JSON.stringify(step)).toContain('本步已记录');
      expect(step.current, JSON.stringify(step)).toBe('current');
      if (step.seq < 9) expect(step.ahead, JSON.stringify(step)).toBe(true);
    } else {
      expect(step.message, JSON.stringify(step)).toContain('报告已在本机生成');
      expect(step.current, JSON.stringify(step)).toBe('done');
    }
  }
  expect(result.reportAfter).toBe(false);

  const popupPromise = page.waitForEvent('popup', { timeout: 20000 });
  await page.locator('[data-sim-ui] [data-destroyer-report]').click({ force: true, noWaitAfter: true, timeout: 20000 });
  const report = await popupPromise;
  await expect(report.locator('body')).toContainText('实验得分：100/100');
  for (const title of ['直航读数', '手操打舵', '舵回中', '小角度转向', '直角转向', '反向直角', '连续变向', '定常回转', '扰动直航', '确认报告']) {
    await expect(report.locator('body')).toContainText(title);
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
