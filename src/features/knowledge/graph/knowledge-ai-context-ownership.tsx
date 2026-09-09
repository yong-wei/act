'use client';

import { createContext, useContext } from 'react';

const OwnershipContext = createContext(true);
export const KnowledgeAiContextOwnership = OwnershipContext.Provider;
export function useKnowledgeAiContextOwnership(): boolean {
  return useContext(OwnershipContext);
}
