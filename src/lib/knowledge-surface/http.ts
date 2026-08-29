import { NextResponse } from 'next/server';

import {
  KNOWLEDGE_SURFACE_SELECTOR_FIXED_CODE,
  KNOWLEDGE_SURFACE_SELECTOR_FIXED_MESSAGE,
  forbiddenIdentitySelectorFromRequest,
} from './selectors';

export function knowledgeSurfaceSelectorRejection(request: Request): NextResponse | null {
  const parameter = forbiddenIdentitySelectorFromRequest(request);
  if (!parameter) return null;
  return NextResponse.json(
    {
      error: KNOWLEDGE_SURFACE_SELECTOR_FIXED_MESSAGE,
      code: KNOWLEDGE_SURFACE_SELECTOR_FIXED_CODE,
      parameter,
    },
    { status: 400 },
  );
}
