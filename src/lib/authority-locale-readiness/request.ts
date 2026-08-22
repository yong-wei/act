import { NextResponse } from 'next/server';

import {
  HISTORICAL_ENGLISH_UNAVAILABLE_ZH,
  type AdmittedLocale,
  type PublicLocaleCapability,
} from './contracts';
import { isAdmittedLocale } from './qualify';
import { historicalLocaleCapability } from './presentation-state';
import { qualifyPublishedLatestComposite } from './published';

export interface LocaleRequestResolution {
  readonly ok: true;
  readonly locale: AdmittedLocale;
  readonly capability: PublicLocaleCapability;
}

export interface LocaleRequestRejection {
  readonly ok: false;
  readonly response: NextResponse;
}

export function activeLocaleCapability(repoRoot = process.cwd()): PublicLocaleCapability {
  try {
    const published = qualifyPublishedLatestComposite(repoRoot);
    if (published.bilingualReady) {
      return {
        availableLocales: ['zh-CN', 'en'],
        bilingualReady: true,
        englishUnavailableReason: null,
        mode: 'complete-locale',
      };
    }
  } catch {
    return historicalLocaleCapability();
  }
  return historicalLocaleCapability();
}

export function resolveActiveLocaleRequest(
  request: Request,
  capability: PublicLocaleCapability = historicalLocaleCapability(),
): LocaleRequestResolution | LocaleRequestRejection {
  const url = new URL(request.url);
  const raw = url.searchParams.get('locale');
  const locale = raw == null || raw.length === 0 ? 'zh-CN' : raw;
  if (!isAdmittedLocale(locale)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: '未知显示语言，已停止投影。',
          code: 'ACTIVE_GRAPH_LOCALE_UNKNOWN',
        },
        { status: 400 },
      ),
    };
  }
  if (locale === 'en' && !capability.bilingualReady) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: capability.englishUnavailableReason ?? HISTORICAL_ENGLISH_UNAVAILABLE_ZH,
          code: 'ACTIVE_GRAPH_LOCALE_ENGLISH_UNAVAILABLE',
        },
        { status: 409 },
      ),
    };
  }
  return { ok: true, locale, capability };
}

export function localeQuery(locale: AdmittedLocale): string {
  return `locale=${encodeURIComponent(locale)}`;
}
