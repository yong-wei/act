'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  X,
  Search,
  UserPlus,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  studentNumber?: string;
  currentClassId?: string;
  currentClassName?: string;
}

interface ImportResult {
  success: string[];
  failed: { studentNumber: string; reason: string }[];
  summary: {
    total: number;
    successCount: number;
    failedCount: number;
  };
}

interface AddStudentsModalProps {
  classId: string;
  className: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddStudentsModal({
  classId,
  className,
  isOpen,
  onClose,
  onSuccess,
}: AddStudentsModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'import'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [addedStudents, setAddedStudents] = useState<Set<string>>(new Set());

  // Excel导入状态
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchStudents = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 1) {
      setSearchError('请输入至少2个字符');
      setSearchResults([]);
      return;
    }

    const params = new URLSearchParams({ excludeClassId: classId });
    if (trimmedQuery.length >= 2) {
      params.set('q', trimmedQuery);
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/teacher/students/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.error || '加载学生名单失败');
        setSearchResults([]);
        return;
      }

      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('加载学生名单失败，请重试');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [classId]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'search') return;

    setSearchQuery('');
    void fetchStudents('');
  }, [activeTab, fetchStudents, isOpen]);

  // 搜索学生
  const handleSearch = useCallback(async () => {
    await fetchStudents(searchQuery);
  }, [fetchStudents, searchQuery]);

  // 添加学生到班级
  const handleAddStudent = async (student: Student) => {
    setIsAdding(student.id);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: student.id }),
      });

      if (res.ok) {
        setAddedStudents(prev => new Set([...Array.from(prev), student.id]));
        // 从搜索结果中移除
        setSearchResults(prev => prev.filter(s => s.id !== student.id));
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || '添加失败');
      }
    } catch (error) {
      console.error('Add student error:', error);
      alert('添加失败');
    } finally {
      setIsAdding(null);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  // 导入Excel
  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`/api/teacher/classes/${classId}/students/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setImportResult(data);
        if (data.summary.successCount > 0) {
          onSuccess();
        }
      } else {
        alert(data.error || '导入失败');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  // 重置导入状态
  const resetImport = () => {
    setSelectedFile(null);
    setImportResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <div>
            <h2 className="text-lg font-semibold text-white">添加学生到班级</h2>
            <p className="text-sm text-slate-400">{className}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'border-b-2 border-sky-500 text-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="mr-2 inline h-4 w-4" />
            搜索添加
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'border-b-2 border-sky-500 text-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="mr-2 inline h-4 w-4" />
            Excel导入
          </button>
        </div>

        {/* 内容区 */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {activeTab === 'search' ? (
            <div className="space-y-4">
              {/* 搜索框 */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索姓名、账号或学号..."
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2 pl-10 pr-4 text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searchQuery.trim().length === 1 || isSearching}
                  className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
                >
                  {isSearching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    searchQuery.trim().length >= 2 ? '搜索' : '刷新'
                  )}
                </button>
              </div>

              {/* 搜索提示 */}
              {searchQuery.trim().length === 1 && !searchError && (
                <p className="text-sm text-slate-500">请输入至少2个字符</p>
              )}

              {searchError && (
                <p className="flex items-center gap-2 text-sm text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  {searchError}
                </p>
              )}

              {/* 搜索结果 */}
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3"
                    >
                      <div>
                        <p className="font-medium text-white">{student.name}</p>
                        <p className="text-sm text-slate-400">
                          {student.studentNumber && (
                            <span className="mr-2">学号: {student.studentNumber}</span>
                          )}
                          <span>{student.email}</span>
                        </p>
                        {student.currentClassName && (
                          <p className="text-xs text-amber-400">
                            当前班级: {student.currentClassName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleAddStudent(student)}
                        disabled={isAdding === student.id || addedStudents.has(student.id)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {isAdding === student.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : addedStudents.has(student.id) ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            已添加
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" />
                            添加
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                !isSearching && (
                  <div className="py-8 text-center text-slate-500">
                    {searchQuery.trim().length >= 2 ? '未找到匹配的学生' : '暂无可添加的候选学生'}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Excel导入说明 */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h3 className="mb-2 font-medium text-white">Excel文件格式要求</h3>
                <ul className="space-y-1 text-sm text-slate-400">
                  <li>• 第一行为标题行（如：学号）</li>
                  <li>• 第一列为学号（studentNumber）</li>
                  <li>• 支持 .xlsx 格式</li>
                  <li>• 仅导入系统中已存在的学生账号</li>
                </ul>
              </div>

              {/* 文件上传 */}
              {!importResult ? (
                <div className="space-y-4">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/30 p-8 transition hover:border-sky-500 hover:bg-slate-800/50">
                    <FileSpreadsheet className="mb-3 h-12 w-12 text-slate-500" />
                    {selectedFile ? (
                      <p className="text-white">{selectedFile.name}</p>
                    ) : (
                      <>
                        <p className="text-white">点击选择Excel文件</p>
                        <p className="mt-1 text-sm text-slate-500">或拖拽文件到此处</p>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>

                  {selectedFile && (
                    <button
                      onClick={handleImport}
                      disabled={isImporting}
                      className="w-full rounded-lg bg-sky-600 py-3 font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
                    >
                      {isImporting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          正在导入...
                        </span>
                      ) : (
                        '开始导入'
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 导入结果摘要 */}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <h3 className="mb-3 font-medium text-white">导入结果</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-white">
                          {importResult.summary.total}
                        </p>
                        <p className="text-sm text-slate-400">总计</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-400">
                          {importResult.summary.successCount}
                        </p>
                        <p className="text-sm text-slate-400">成功</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-400">
                          {importResult.summary.failedCount}
                        </p>
                        <p className="text-sm text-slate-400">失败</p>
                      </div>
                    </div>
                  </div>

                  {/* 失败清单 */}
                  {importResult.failed.length > 0 && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                      <h4 className="mb-2 flex items-center gap-2 font-medium text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        未成功导入的学生
                      </h4>
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-400">
                              <th className="pb-2">学号</th>
                              <th className="pb-2">原因</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.failed.map((item, index) => (
                              <tr key={index} className="border-t border-slate-700">
                                <td className="py-2 text-white">{item.studentNumber}</td>
                                <td className="py-2 text-red-400">{item.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 成功清单 */}
                  {importResult.success.length > 0 && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <h4 className="mb-2 flex items-center gap-2 font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        成功导入的学生 ({importResult.success.length})
                      </h4>
                      <p className="text-sm text-slate-400">
                        {importResult.success.join(', ')}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={resetImport}
                    className="w-full rounded-lg border border-slate-600 py-2 text-white transition hover:bg-slate-800"
                  >
                    继续导入
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="border-t border-slate-700 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-slate-600 py-2 text-white transition hover:bg-slate-800"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
