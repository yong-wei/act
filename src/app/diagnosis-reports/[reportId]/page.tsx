'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DiagnosisReportDeliveryView } from '@/features/teacher/diagnosis-report-delivery-view';
import type { StudentDiagnosisDeliveryProjection } from '@/lib/diagnosis-report-delivery-projection';

export default function StudentDiagnosisReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [projection, setProjection] = useState<StudentDiagnosisDeliveryProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/diagnosis-reports/${encodeURIComponent(reportId)}/student-safe`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { projection?: StudentDiagnosisDeliveryProjection; error?: string };
        if (!response.ok || !payload.projection) throw new Error(payload.error || '读取个人诊断报告失败');
        setProjection(payload.projection);
      }).catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : '读取个人诊断报告失败');
      });
    return () => controller.abort();
  }, [reportId]);

  if (error) return <StudentStatus title="无法打开个人诊断报告" message={error} />;
  if (!projection) return <StudentStatus title="正在读取个人诊断报告" message="正在核验报告归属与安全投影。" />;
  return (
    <DiagnosisReportDeliveryView
      projection={projection}
      actions={[]}
      dispositionEvents={[]}
      returnHref="/dashboard"
      teacherMode={false}
    />
  );
}

function StudentStatus({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-20" data-diagnosis-delivery-status={title.startsWith('正在') ? 'loading' : 'error'}>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-subtle">{message}</p>
      <Link href="/dashboard" className="btn-themed mt-6 inline-block rounded-lg px-4 py-2 text-sm">返回首页</Link>
    </main>
  );
}
