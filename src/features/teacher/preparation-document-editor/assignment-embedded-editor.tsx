'use client';

import { useState } from 'react';
import { Pencil, Save } from 'lucide-react';

import { RuntimeMarkdownContent } from '@/components/shared/runtime-markdown';

import {
  RichMarkdownEditor,
  validateProtectedEditorMarkdownAssets,
  type ProtectedEditorAssetValidator,
  type ProtectedEditorImageUpload,
} from './rich-markdown-editor';

export type AssignmentEmbeddedSaveState = 'editing' | 'saving' | 'saved' | 'failed' | 'conflict';
export type AssignmentEmbeddedHostRole = 'teacher' | 'student';
export type AssignmentEmbeddedField = 'question-prompt' | 'reference-answer' | 'student-response';

export interface AssignmentEmbeddedEditorProps {
  hostRole: AssignmentEmbeddedHostRole;
  field: AssignmentEmbeddedField;
  ariaLabel: string;
  value: string;
  savedValue: string;
  saveState: AssignmentEmbeddedSaveState;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void | Promise<void>;
  uploadImage: ProtectedEditorImageUpload;
  validateAssetReference: ProtectedEditorAssetValidator;
  resolveAssetHref: (href: string) => string;
}

export function AssignmentEmbeddedEditor({
  hostRole,
  field,
  ariaLabel,
  value,
  savedValue,
  saveState,
  readOnly = false,
  onChange,
  onEdit,
  onSave,
  uploadImage,
  validateAssetReference,
  resolveAssetHref,
}: AssignmentEmbeddedEditorProps) {
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const rendered = saveState === 'saved' || readOnly;

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-background p-4"
      aria-label={ariaLabel}
      data-assignment-editor-mode="assignment-embedded"
      data-assignment-editor-role={hostRole}
      data-assignment-editor-field={field}
    >
      {rendered ? (
        <>
          <div className="prose max-w-none" data-assignment-saved-render>
            <RuntimeMarkdownContent markdown={savedValue} resolveAssetHref={resolveAssetHref} />
          </div>
          {!readOnly ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
              编辑
            </button>
          ) : null}
        </>
      ) : (
        <>
          <RichMarkdownEditor
            mode="assignment-embedded"
            value={value}
            onChange={onChange}
            readOnly={saveState === 'saving'}
            ariaLabel={ariaLabel}
            uploadImage={uploadImage}
            onUploadPendingChange={setUploadPending}
            onUploadError={setUploadError}
          />
          {uploadPending ? <p role="status" className="text-sm text-subtle">图片正在安全上传，完成后才能保存。</p> : null}
          {uploadError ? <p role="alert" className="text-sm text-destructive">{uploadError}</p> : null}
          {saveState === 'failed' ? <p role="alert" className="text-sm text-destructive">保存失败，本地内容仍保留，请重试。</p> : null}
          {saveState === 'conflict' ? <p role="alert" className="text-sm text-destructive">服务器已有较新修订，本地内容仍保留，请处理冲突后重试。</p> : null}
          {validationError ? <p role="alert" className="text-sm text-destructive">{validationError}</p> : null}
          <button
            type="button"
            disabled={saveState === 'saving' || uploadPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => {
              if (!validateProtectedEditorMarkdownAssets(value, validateAssetReference)) {
                setValidationError('正文包含无效或不属于当前作业字段的图片，请移除后再保存。');
                return;
              }
              setValidationError(null);
              void onSave();
            }}
          >
            <Save className="h-4 w-4" />
            {saveState === 'saving' ? '保存中…' : '保存'}
          </button>
        </>
      )}
    </section>
  );
}

interface AssignmentEmbeddedHostExampleProps {
  initialValue: string;
  uploadImage: ProtectedEditorImageUpload;
  validateAssetReference: ProtectedEditorAssetValidator;
  resolveAssetHref: (href: string) => string;
  persist: (value: string) => Promise<void>;
}

function AssignmentEmbeddedHostExample({
  hostRole,
  field,
  ariaLabel,
  initialValue,
  uploadImage,
  validateAssetReference,
  resolveAssetHref,
  persist,
}: AssignmentEmbeddedHostExampleProps & {
  hostRole: AssignmentEmbeddedHostRole;
  field: AssignmentEmbeddedField;
  ariaLabel: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [saveState, setSaveState] = useState<AssignmentEmbeddedSaveState>('saved');

  return (
    <AssignmentEmbeddedEditor
      hostRole={hostRole}
      field={field}
      ariaLabel={ariaLabel}
      value={value}
      savedValue={savedValue}
      saveState={saveState}
      onChange={setValue}
      onEdit={() => setSaveState('editing')}
      onSave={async () => {
        setSaveState('saving');
        try {
          await persist(value);
          setSavedValue(value);
          setSaveState('saved');
        } catch (error) {
          setSaveState(error instanceof AssignmentEmbeddedConflictError ? 'conflict' : 'failed');
        }
      }}
      uploadImage={uploadImage}
      validateAssetReference={validateAssetReference}
      resolveAssetHref={resolveAssetHref}
    />
  );
}

export function TeacherAssignmentContentEditorExample(props: AssignmentEmbeddedHostExampleProps) {
  return (
    <AssignmentEmbeddedHostExample
      {...props}
      hostRole="teacher"
      field="question-prompt"
      ariaLabel="作业题目内容"
    />
  );
}

export function StudentAssignmentContentEditorExample(props: AssignmentEmbeddedHostExampleProps) {
  return (
    <AssignmentEmbeddedHostExample
      {...props}
      hostRole="student"
      field="student-response"
      ariaLabel="作业正文"
    />
  );
}

export class AssignmentEmbeddedConflictError extends Error {
  constructor() {
    super('assignment-embedded-save-conflict');
    this.name = 'AssignmentEmbeddedConflictError';
  }
}
