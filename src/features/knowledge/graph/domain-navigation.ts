export type KnowledgeGraphNavigationView =
  | { kind: 'root' }
  | { kind: 'domain'; domainId: string };

export type KnowledgeGraphNavigationStatus = 'ready' | 'loading' | 'failure' | 'incomplete' | 'filtered-empty';

export interface KnowledgeGraphNavigationState {
  view: KnowledgeGraphNavigationView;
  status: KnowledgeGraphNavigationStatus;
  requestId: number | null;
  error: string | null;
  graphVersion: string;
}

export type KnowledgeGraphNavigationAction =
  | { type: 'root-loading'; requestId: number }
  | { type: 'root-loaded'; requestId: number; graphVersion: string }
  | { type: 'root-failed'; requestId: number; error: string }
  | { type: 'enter-domain'; domainId: string; requestId: number; cached: boolean }
  | { type: 'retry-domain'; requestId: number }
  | { type: 'domain-loaded'; domainId: string; requestId: number }
  | { type: 'domain-failed'; domainId: string; requestId: number; error: string }
  | { type: 'domain-incomplete'; domainId: string; requestId: number; error: string }
  | { type: 'domain-filter-result'; domainId: string; visibleMemberCount: number }
  | { type: 'return-root' };

export function createKnowledgeGraphNavigationState(): KnowledgeGraphNavigationState {
  return {
    view: { kind: 'root' },
    status: 'ready',
    requestId: null,
    error: null,
    graphVersion: '',
  };
}

function isCurrentDomainRequest(
  state: KnowledgeGraphNavigationState,
  domainId: string,
  requestId: number
): boolean {
  return state.view.kind === 'domain'
    && state.view.domainId === domainId
    && state.requestId === requestId;
}

export function knowledgeGraphNavigationReducer(
  state: KnowledgeGraphNavigationState,
  action: KnowledgeGraphNavigationAction
): KnowledgeGraphNavigationState {
  switch (action.type) {
    case 'root-loading':
      return {
        ...state,
        view: { kind: 'root' },
        status: 'loading',
        requestId: action.requestId,
        error: null,
      };
    case 'root-loaded':
      if (state.view.kind !== 'root' || state.requestId !== action.requestId) return state;
      return {
        view: { kind: 'root' },
        status: 'ready',
        requestId: null,
        error: null,
        graphVersion: action.graphVersion,
      };
    case 'root-failed':
      if (state.view.kind !== 'root' || state.requestId !== action.requestId) return state;
      return { ...state, status: 'failure', error: action.error };
    case 'enter-domain':
      return {
        ...state,
        view: { kind: 'domain', domainId: action.domainId },
        status: action.cached ? 'ready' : 'loading',
        requestId: action.cached ? null : action.requestId,
        error: null,
      };
    case 'retry-domain':
      if (state.view.kind !== 'domain') return state;
      return { ...state, status: 'loading', requestId: action.requestId, error: null };
    case 'domain-loaded':
      if (!isCurrentDomainRequest(state, action.domainId, action.requestId)) return state;
      return { ...state, status: 'ready', requestId: null, error: null };
    case 'domain-failed':
      if (!isCurrentDomainRequest(state, action.domainId, action.requestId)) return state;
      return { ...state, status: 'failure', error: action.error };
    case 'domain-incomplete':
      if (!isCurrentDomainRequest(state, action.domainId, action.requestId)) return state;
      return { ...state, status: 'incomplete', error: action.error };
    case 'domain-filter-result':
      if (state.view.kind !== 'domain' || state.view.domainId !== action.domainId) return state;
      if (state.status !== 'ready' && state.status !== 'filtered-empty') return state;
      if (
        state.status === (action.visibleMemberCount === 0 ? 'filtered-empty' : 'ready')
        && state.error === null
      ) return state;
      return {
        ...state,
        status: action.visibleMemberCount === 0 ? 'filtered-empty' : 'ready',
        error: null,
      };
    case 'return-root':
      return {
        ...createKnowledgeGraphNavigationState(),
        graphVersion: state.graphVersion,
      };
  }
}
