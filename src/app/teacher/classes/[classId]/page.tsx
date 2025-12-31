'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Copy,
  Check,
  GraduationCap,
  ChevronRight,
  Settings,
} from 'lucide-react';

interface Student {
  id: string;
  studentNumber: string | null;
  techScore: number;
  ethicsScore: number;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface ClassDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  year: string | null;
  semester: string | null;
  isActive: boolean;
  students: Student[];
  _count: { students: number };
}

export default function ClassDetailPage() {
  const params = useParams();
  const classId = params?.classId as string;
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchClass = async () => {
    if (!classId) return;
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`);
      if (res.ok) {
        const data = await res.json();
        setClassData(data);
      }
    } catch (error) {
      console.error('获取班级详情失败', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (classId) {
      fetchClass();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const copyCode = async () => {
    if (classData) {
      await navigator.clipboard.writeText(classData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-slate-800" />
          <div className="h-32 rounded-xl bg-slate-800" />
        </div>
      </main>
    );
  }

  if (!classData) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="text-center">
          <p className="text-xl text-slate-400">班级不存在</p>
          <Link
            href="/teacher/classes"
            className="mt-4 inline-block text-sky-400 hover:text-sky-300"
          >
            返回班级列表
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      {/* 返回链接 */}
      <Link
        href="/teacher/classes"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        返回班级列表
      </Link>

      {/* 班级信息卡片 */}
      <div className="mb-8 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{classData.name}</h1>
              {classData.description && (
                <p className="mt-1 text-slate-400">{classData.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                {classData.year && <span>{classData.year}</span>}
                {classData.semester && <span>{classData.semester}</span>}
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  {classData._count.students} 名学生
                </span>
              </div>
            </div>
          </div>

          {/* 班级码 */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
            <p className="text-xs text-sky-300">班级加入码</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-2xl font-bold tracking-wider text-sky-400">
                {classData.code}
              </span>
              <button
                onClick={copyCode}
                className="rounded-lg border border-sky-500/30 p-2 text-sky-400 transition hover:bg-sky-500/20"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">学生输入此码加入班级</p>
          </div>
        </div>
      </div>

      {/* 学生列表 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">班级学生</h2>
          <span className="text-sm text-slate-400">{classData.students.length} 人</span>
        </div>

        {classData.students.length === 0 ? (
          <div className="py-12 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-slate-600" />
            <p className="mt-4 text-slate-500">暂无学生加入此班级</p>
            <p className="mt-2 text-sm text-slate-600">
              将班级码 <span className="font-mono text-sky-400">{classData.code}</span> 分享给学生
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {classData.students.map((student) => (
              <Link
                key={student.id}
                href={`/teacher/classes/${classId}/students/${student.user.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition hover:border-sky-500/50 hover:bg-slate-800"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white">
                    {student.user.name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {student.user.name || '未命名学生'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {student.studentNumber || student.user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-slate-400">技术分</p>
                    <p className="text-lg font-semibold text-amber-400">
                      {student.techScore.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">伦理分</p>
                    <p className="text-lg font-semibold text-emerald-400">
                      {student.ethicsScore}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
