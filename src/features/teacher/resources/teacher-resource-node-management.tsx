'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Filter,
  GitBranch,
  Pencil,
  Search,
  ShieldAlert,
} from 'lucide-react';

import type {
  ResourceNodeKnowledgeMappingFilter,
  TeacherResourceNodeSummary,
  TeacherResourceNodeView,
} from '@/lib/teacher-resource-node-management';
import type {
  ResourceNodeAvailability,
  ResourceNodeCognitiveLoad,
  ResourceNodePrivacyLevel,
  ResourceNodeTeacherPolicy,
  ResourceNodeType,
} from '@/lib/resource-node-registry';

interface TeacherResourceNodeManagementProps {
  initialNodes: TeacherResourceNodeView[];
  initialSummary: TeacherResourceNodeSummary;
  supportedTypes: readonly ResourceNodeType[];
}

type PathFilter = 'all' | 'eligible' | 'excluded';

const AVAILABILITY_OPTIONS: Array<ResourceNodeAvailability | 'all'> = ['all', 'available', 'draft', 'archived', 'teacher_only'];
const POLICY_OPTIONS: Array<ResourceNodeTeacherPolicy | 'all'> = ['all', 'allowed', 'teacher-assigned', 'teacher-only', 'blocked'];
const PRIVACY_OPTIONS: Array<ResourceNodePrivacyLevel | 'all'> = ['all', 'student-visible', 'teacher-scoped', 'admin-scoped'];
const COGNITIVE_LOAD_OPTIONS: ResourceNodeCognitiveLoad[] = ['low', 'medium', 'high'];

export function TeacherResourceNodeManagement({
  initialNodes,
  initialSummary,
  supportedTypes,
}: TeacherResourceNodeManagementProps) {
  const [nodes, setNodes] = useState(initialNodes);
  const [catalogSummary, setCatalogSummary] = useState(initialSummary);
  const [selectedId, setSelectedId] = useState(initialNodes[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [nodeType, setNodeType] = useState<ResourceNodeType | 'all'>('all');
  const [availability, setAvailability] = useState<ResourceNodeAvailability | 'all'>('all');
  const [teacherPolicy, setTeacherPolicy] = useState<ResourceNodeTeacherPolicy | 'all'>('all');
  const [privacyLevel, setPrivacyLevel] = useState<ResourceNodePrivacyLevel | 'all'>('all');
  const [pathFilter, setPathFilter] = useState<PathFilter>('all');
  const [knowledgeMapping, setKnowledgeMapping] = useState<ResourceNodeKnowledgeMappingFilter>('all');
  const [courseModule, setCourseModule] = useState('');
  const [knowledge, setKnowledge] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const filteredNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedCourseModule = courseModule.trim().toLowerCase();
    const normalizedKnowledge = knowledge.trim().toLowerCase();
    return nodes.filter((node) => {
      if (normalizedQuery && ![
        node.id,
        node.title,
        node.type,
        node.sourceKind,
        ...node.sourceRefs.flatMap((source) => [source.kind, source.ref]),
      ].join(' ').toLowerCase().includes(normalizedQuery)) {
        return false;
      }
      if (nodeType !== 'all' && node.type !== nodeType) return false;
      if (availability !== 'all' && node.availability !== availability) return false;
      if (teacherPolicy !== 'all' && node.teacherPolicy !== teacherPolicy) return false;
      if (privacyLevel !== 'all' && node.privacyLevel !== privacyLevel) return false;
      if (pathFilter === 'eligible' && !node.pathEligible) return false;
      if (pathFilter === 'excluded' && node.pathEligible) return false;
      if (knowledgeMapping === 'mapped' && node.knowledgeCoverage.length === 0) return false;
      if (knowledgeMapping === 'unmapped' && node.knowledgeCoverage.length > 0) return false;
      if (normalizedCourseModule && !node.courseModule?.toLowerCase().includes(normalizedCourseModule)) return false;
      if (normalizedKnowledge && !node.knowledgeCoverage.some((item) => item.toLowerCase().includes(normalizedKnowledge))) {
        return false;
      }
      return true;
    });
  }, [availability, courseModule, knowledge, knowledgeMapping, nodeType, nodes, pathFilter, privacyLevel, query, teacherPolicy]);

  const selectedNode = filteredNodes.find((node) => node.id === selectedId) ?? filteredNodes[0] ?? null;
  const summary = buildSummary(filteredNodes);

  useEffect(() => {
    let cancelled = false;
    async function loadRegisteredResources() {
      const response = await fetch('/api/teacher/resource-nodes');
      if (!response.ok) return;
      const payload = await response.json() as {
        nodes?: TeacherResourceNodeView[];
        summary?: TeacherResourceNodeSummary;
      };
      if (cancelled || !payload.nodes) return;
      setNodes(payload.nodes);
      if (payload.summary) setCatalogSummary(payload.summary);
      const firstNode = payload.nodes[0];
      if (firstNode) setSelectedId((current) => current || firstNode.id);
    }

    void loadRegisteredResources();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedNode?.editable) return;

    const form = new FormData(event.currentTarget);
    setSaveState('saving');
    const response = await fetch(`/api/teacher/resource-nodes/${encodeURIComponent(selectedNode.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: valueOrUndefined(form.get('displayName')),
        description: valueOrUndefined(form.get('description')),
        planningMetadata: {
          prerequisites: splitCsv(form.get('prerequisites')),
          knowledgeCoverage: splitCsv(form.get('knowledgeCoverage')),
          estimatedTimeMinutes: numberOrNull(form.get('estimatedTimeMinutes')),
          cognitiveLoad: form.get('cognitiveLoad'),
          availability: form.get('availability'),
          teacherPolicy: form.get('teacherPolicy'),
          privacyLevel: form.get('privacyLevel'),
          pathEligible: form.get('pathEligible') === 'true',
        },
      }),
    });

    if (!response.ok) {
      setSaveState('error');
      return;
    }

    const payload = await response.json();
    const updatedNode = payload.node as TeacherResourceNodeView;
    setNodes((current) => current.map((node) => node.id === updatedNode.id ? updatedNode : node));
    setSelectedId(updatedNode.id);
    setSaveState('saved');
  }

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8 text-slate-100">
      <div className="mb-8">
        <Link
          href="/teacher/resources"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-cyan-400"
        >
          <ArrowLeft className="h-4 w-4" />
          返回教学资源管理
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">ResourceNode 管理</h1>
            <p className="mt-2 text-slate-400">统一查看资源映射、路径资格、策略和治理告警。</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <SummaryCell label="资源" value={catalogSummary.totalNodes} />
            <SummaryCell label="当前" value={summary.totalNodes} />
            <SummaryCell label="可规划" value={summary.pathEligibleNodes} />
            <SummaryCell label="告警" value={summary.warningNodes} />
          </div>
        </div>
      </div>

      <section className="mb-6 border-y border-slate-800 py-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Filter className="h-4 w-4" />
          筛选
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-8">
          <label className="relative md:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、来源或类型"
              className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-500"
            />
          </label>
          <Select value={nodeType} onChange={(value) => setNodeType(value as ResourceNodeType | 'all')}>
            <option value="all">全部类型</option>
            {supportedTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
          <Select value={availability} onChange={(value) => setAvailability(value as ResourceNodeAvailability | 'all')}>
            {AVAILABILITY_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select value={teacherPolicy} onChange={(value) => setTeacherPolicy(value as ResourceNodeTeacherPolicy | 'all')}>
            {POLICY_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select value={privacyLevel} onChange={(value) => setPrivacyLevel(value as ResourceNodePrivacyLevel | 'all')}>
            {PRIVACY_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select value={pathFilter} onChange={(value) => setPathFilter(value as PathFilter)}>
            <option value="all">全部路径资格</option>
            <option value="eligible">可规划</option>
            <option value="excluded">已排除</option>
          </Select>
          <Select value={knowledgeMapping} onChange={(value) => setKnowledgeMapping(value as ResourceNodeKnowledgeMappingFilter)}>
            <option value="all">全部知识映射</option>
            <option value="mapped">已映射</option>
            <option value="unmapped">未映射</option>
          </Select>
          <input aria-label="课程/模块"
            value={courseModule}
            onChange={(event) => setCourseModule(event.target.value)}
            placeholder="课程/模块"
            className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-cyan-500"
          />
          <input aria-label="知识点 ID"
            value={knowledge}
            onChange={(event) => setKnowledge(event.target.value)}
            placeholder="知识点 ID"
            className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-cyan-500"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">
          <div className="grid gap-3">
            {filteredNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedId(node.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedNode?.id === node.id
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-white">{node.title}</h2>
                      <Badge>{node.type}</Badge>
                      {node.editable && <Badge tone="cyan">可编辑</Badge>}
                    </div>
                    <p className="mt-1 break-all text-xs text-slate-500">{node.id}</p>
                  </div>
                  <EligibilityBadge node={node} />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-4">
                  <Metric label="知识映射" value={node.knowledgeCoverage.length ? node.knowledgeCoverage.join(', ') : '未映射'} />
                  <Metric label="课程/模块" value={node.courseModule ?? '未标注'} />
                  <Metric label="可用性" value={node.availability} />
                  <Metric label="教师策略" value={node.teacherPolicy} />
                </div>
                {node.warnings.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {node.warnings.map((warning) => (
                      <span key={`${node.id}:${warning.code}`} className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                        <AlertTriangle className="h-3 w-3" />
                        {warning.code}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        <aside className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
          {selectedNode ? (
            <NodeDetail key={selectedNode.id} node={selectedNode} saveState={saveState} onSave={handleSave} />
          ) : (
            <div className="text-sm text-slate-400">没有符合当前筛选条件的 ResourceNode。</div>
          )}
        </aside>
      </div>
    </main>
  );
}

function NodeDetail({
  node,
  saveState,
  onSave,
}: {
  node: TeacherResourceNodeView;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{node.title}</h2>
          <p className="mt-1 break-all text-xs text-slate-500">{node.id}</p>
        </div>
        <EligibilityBadge node={node} />
      </div>

      <div className="mb-5 grid gap-2 text-sm text-slate-300">
        <Metric label="来源" value={node.sourceRefs.map((source) => `${source.kind}:${source.ref}`).join(', ')} />
        <Metric label="课程/模块" value={node.courseModule ?? '未标注'} />
        <Metric label="渲染入口" value={node.renderTarget ?? '未配置'} />
        <Metric label="启动入口" value={node.launchTarget ?? '未配置'} />
        <Metric label="证据采集" value={node.evidenceInstrumentationConfigured ? '已配置' : '未配置'} />
      </div>

      {(node.renderTarget || node.launchTarget) && (
        <Link
          href={node.launchTarget ?? node.renderTarget ?? '#'}
          className="mb-5 inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-sm text-slate-200 hover:border-cyan-500 hover:text-cyan-200"
        >
          <ExternalLink className="h-4 w-4" />
          打开资源
        </Link>
      )}

      {node.warnings.length > 0 && (
        <div className="mb-5 space-y-2">
          {node.warnings.map((warning) => (
            <div key={warning.code} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4" />
                {warning.code}
              </div>
              <p className="mt-1 text-amber-100/80">{warning.message}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={onSave} className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Pencil className="h-4 w-4" />
          规划元数据
        </div>
        <Field name="displayName" label="显示名称" defaultValue={node.title} disabled={!node.editable} />
        <Field name="description" label="描述" defaultValue={node.description ?? ''} disabled={!node.editable} />
        <Field name="knowledgeCoverage" label="知识映射" defaultValue={node.knowledgeCoverage.join(', ')} disabled={!node.editable} />
        <Field name="prerequisites" label="前置节点" defaultValue={node.prerequisites.join(', ')} disabled={!node.editable} />
        <Field
          name="estimatedTimeMinutes"
          label="预计分钟"
          type="number"
          defaultValue={node.estimatedTimeMinutes?.toString() ?? ''}
          disabled={!node.editable}
        />
        <FormSelect name="cognitiveLoad" label="认知负荷" defaultValue={node.cognitiveLoad} disabled={!node.editable}>
          {COGNITIVE_LOAD_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
        </FormSelect>
        <FormSelect name="availability" label="可用性" defaultValue={node.availability} disabled={!node.editable}>
          {AVAILABILITY_OPTIONS.filter((value) => value !== 'all').map((value) => <option key={value} value={value}>{value}</option>)}
        </FormSelect>
        <FormSelect name="teacherPolicy" label="教师策略" defaultValue={node.teacherPolicy} disabled={!node.editable}>
          {POLICY_OPTIONS.filter((value) => value !== 'all').map((value) => <option key={value} value={value}>{value}</option>)}
        </FormSelect>
        <FormSelect name="privacyLevel" label="隐私级别" defaultValue={node.privacyLevel} disabled={!node.editable}>
          {PRIVACY_OPTIONS.filter((value) => value !== 'all').map((value) => <option key={value} value={value}>{value}</option>)}
        </FormSelect>
        <FormSelect name="pathEligible" label="路径资格" defaultValue={node.pathEligible ? 'true' : 'false'} disabled={!node.editable}>
          <option value="true">允许</option>
          <option value="false">排除</option>
        </FormSelect>
        <button
          type="submit"
          disabled={!node.editable || saveState === 'saving'}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <GitBranch className="h-4 w-4" />
          {saveState === 'saving' ? '保存中' : '保存'}
        </button>
        {saveState === 'saved' && <span className="ml-3 text-sm text-emerald-300">已保存</span>}
        {saveState === 'error' && <span className="ml-3 text-sm text-rose-300">保存失败</span>}
      </form>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-cyan-500"
    >
      {children}
    </select>
  );
}

function FormSelect({
  name,
  label,
  defaultValue,
  disabled,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-400">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-cyan-500 disabled:text-slate-500"
      >
        {children}
      </select>
    </label>
  );
}

function Field({
  name,
  label,
  defaultValue,
  disabled,
  type = 'text',
}: {
  name: string;
  label: string;
  defaultValue: string;
  disabled: boolean;
  type?: 'text' | 'number';
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        disabled={disabled}
        className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-cyan-500 disabled:text-slate-500"
      />
    </label>
  );
}

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'cyan' }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs ${tone === 'cyan' ? 'bg-cyan-500/15 text-cyan-200' : 'bg-slate-700 text-slate-200'}`}>
      {children}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="truncate text-sm text-slate-200" title={value}>{value}</div>
    </div>
  );
}

function EligibilityBadge({ node }: { node: TeacherResourceNodeView }) {
  return node.pathEligible ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      可规划
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-1 text-xs text-rose-200">
      <AlertTriangle className="h-3 w-3" />
      已排除
    </span>
  );
}

function buildSummary(nodes: TeacherResourceNodeView[]): TeacherResourceNodeSummary {
  return {
    totalNodes: nodes.length,
    pathEligibleNodes: nodes.filter((node) => node.pathEligible).length,
    warningNodes: nodes.filter((node) => node.warnings.length > 0).length,
    excludedNodes: nodes.filter((node) => !node.pathEligible).length,
  };
}

function splitCsv(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function valueOrUndefined(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
