'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DiagnosisReportDeliveryView } from '@/features/teacher/diagnosis-report-delivery-view';
import type { DiagnosisDeliveryAction } from '@/lib/diagnosis-report-delivery';
import type { DiagnosisDeliveryProjection } from '@/lib/diagnosis-report-delivery-projection';

type DeliveryPayload = {
  projection: DiagnosisDeliveryProjection;
  actions: DiagnosisDeliveryAction[];
  dispositionEvents: Array<{
    id: string;
    targetKind: string;
    targetKey: string;
    action: string;
    actionRef: string | null;
    result: string;
    createdAt: string;
  }>;
};

export default function TeacherDiagnosisReportPage() {
  const params = useParams<{ classId: string; reportId: string }>();
  const searchParams = useSearchParams();
  const classId = params.classId;
  const reportId = params.reportId;
  const role = searchParams.get('role') === 'student' ? 'student' : 'teacher';
  const [delivery, setDelivery] = useState<DeliveryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setDelivery(null);
    setError(null);
    void fetch(
      `/api/teacher/classes/${encodeURIComponent(classId)}/diagnosis-reports/${encodeURIComponent(reportId)}?role=${role}`,
      { signal: controller.signal },
    ).then(async (response) => {
      const payload = await response.json() as DeliveryPayload & { error?: string };
      if (!response.ok || !payload.projection) throw new Error(payload.error || '读取诊断交付报告失败');
      setDelivery(payload);
    }).catch((fetchError) => {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
      setError(fetchError instanceof Error ? fetchError.message : '读取诊断交付报告失败');
    });
    return () => controller.abort();
  }, [classId, reportId, role]);

  if (error) return <DeliveryStatus title="无法打开诊断交付报告" message={error} returnHref={`/teacher/classes/${encodeURIComponent(classId)}`} />;
  if (!delivery) return <DeliveryStatus title="正在读取固定报告" message="正在核验报告版本与教师权限。" returnHref={`/teacher/classes/${encodeURIComponent(classId)}`} />;

  return (
    <DiagnosisReportDeliveryView
      projection={delivery.projection}
      actions={delivery.actions}
      dispositionEvents={delivery.dispositionEvents}
      dispositionHref={`/api/teacher/classes/${encodeURIComponent(classId)}/diagnosis-reports/${encodeURIComponent(reportId)}/dispositions`}
      returnHref={`/teacher/classes/${encodeURIComponent(classId)}`}
      teacherMode={role === 'teacher'}
    />
  );
}

function DeliveryStatus({ title, message, returnHref }: { title: string; message: string; returnHref: string }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-20" data-diagnosis-delivery-status={title.startsWith('正在') ? 'loading' : 'error'}>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-subtle">{message}</p>
      <Link href={returnHref} className="btn-themed mt-6 inline-block rounded-lg px-4 py-2 text-sm">返回报告历史</Link>
    </main>
  );
}
