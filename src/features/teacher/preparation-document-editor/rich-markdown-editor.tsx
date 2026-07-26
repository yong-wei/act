'use client';

import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import { Mathematics, migrateMathStrings } from '@tiptap/extension-mathematics';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import {
  BoldIcon,
  Braces,
  Code2,
  Heading2,
  ItalicIcon,
  List,
  ListOrdered,
  ImagePlus,
  Sigma,
  Table2,
} from 'lucide-react';

export const PREPARATION_MARKDOWN_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
  TableKit.configure({ table: { resizable: false } }),
  Image.configure({ allowBase64: false }),
  Mathematics,
  Markdown.configure({ markedOptions: { gfm: true, breaks: false } }),
];

export type RichMarkdownEditorMode = 'document' | 'assignment-embedded';

export interface ProtectedEditorAssetReference {
  assetId: string;
  href: string;
  altText?: string;
}

export type ProtectedEditorImageUpload = (file: File) => Promise<ProtectedEditorAssetReference>;

export function RichMarkdownEditor({
  value,
  onChange,
  readOnly = false,
  ariaLabel = '文档正文',
  mode = 'document',
  uploadImage,
  onUploadPendingChange,
  onUploadError,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  ariaLabel?: string;
  mode?: RichMarkdownEditorMode;
  uploadImage?: ProtectedEditorImageUpload;
  onUploadPendingChange?: (pending: boolean) => void;
  onUploadError?: (message: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadsRef = useRef(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: PREPARATION_MARKDOWN_EXTENSIONS,
    content: value,
    contentType: 'markdown',
    editable: !readOnly,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        class: `${mode === 'assignment-embedded' ? 'min-h-44' : 'min-h-[32rem]'} max-w-none px-5 py-6 text-[15px] leading-7 outline-none`,
      },
      handleDrop: (_view, event) => {
        if (mode !== 'assignment-embedded' || !uploadImage || !editor) return false;
        const files = imageFiles(event.dataTransfer?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertProtectedEditorImages(editor, files, uploadImage, {
          onPendingChange: updatePendingUploads,
          onError: onUploadError,
        });
        return true;
      },
      handlePaste: (_view, event) => {
        if (mode !== 'assignment-embedded' || !uploadImage || !editor) return false;
        const files = imageFiles(event.clipboardData?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertProtectedEditorImages(editor, files, uploadImage, {
          onPendingChange: updatePendingUploads,
          onError: onUploadError,
        });
        return true;
      },
    },
    onCreate: ({ editor: current }) => migratePreparationMath(current),
    onUpdate: ({ editor: current }) => onChange(current.getMarkdown()),
  });

  function updatePendingUploads(delta: 1 | -1) {
    pendingUploadsRef.current = Math.max(0, pendingUploadsRef.current + delta);
    onUploadPendingChange?.(pendingUploadsRef.current > 0);
  }

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || editor.getMarkdown() === value) return;
    replacePreparationMarkdown(editor, value);
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-[32rem] animate-pulse rounded-lg bg-muted" aria-label="编辑器加载中" />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background" data-preparation-rich-editor>
      {!readOnly ? (
        <div className="flex flex-wrap gap-1 border-b border-border bg-muted/40 p-2" role="toolbar" aria-label="文档格式">
          <ToolbarButton label="二级标题" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolbarButton>
          <ToolbarButton label="粗体" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><BoldIcon /></ToolbarButton>
          <ToolbarButton label="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon /></ToolbarButton>
          <ToolbarButton label="无序列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></ToolbarButton>
          <ToolbarButton label="有序列表" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></ToolbarButton>
          <ToolbarButton label="行内代码" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code2 /></ToolbarButton>
          <ToolbarButton label="代码块" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Braces /></ToolbarButton>
          <ToolbarButton label="插入表格" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 /></ToolbarButton>
          <ToolbarButton label="插入公式" onClick={() => editor.chain().focus().insertInlineMath({ latex: 'x' }).run()}><Sigma /></ToolbarButton>
          {mode === 'assignment-embedded' && uploadImage ? (
            <>
              <ToolbarButton label="插入图片" onClick={() => fileInputRef.current?.click()}><ImagePlus /></ToolbarButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="选择要插入的图片"
                onChange={(event) => {
                  const files = imageFiles(event.currentTarget.files);
                  event.currentTarget.value = '';
                  if (files.length === 0) return;
                  void insertProtectedEditorImages(editor, files, uploadImage, {
                    onPendingChange: updatePendingUploads,
                    onError: onUploadError,
                  });
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
      <EditorContent
        editor={editor}
        className="[&_.tiptap>blockquote]:border-l-4 [&_.tiptap>blockquote]:pl-4 [&_.tiptap>h1]:text-3xl [&_.tiptap>h1]:font-semibold [&_.tiptap>h2]:mt-6 [&_.tiptap>h2]:text-2xl [&_.tiptap>h2]:font-semibold [&_.tiptap>h3]:mt-5 [&_.tiptap>h3]:text-xl [&_.tiptap>h3]:font-semibold [&_.tiptap>ol]:list-decimal [&_.tiptap>ol]:pl-6 [&_.tiptap>pre]:overflow-auto [&_.tiptap>pre]:rounded-lg [&_.tiptap>pre]:bg-muted [&_.tiptap>pre]:p-4 [&_.tiptap>table]:w-full [&_.tiptap>table]:border-collapse [&_.tiptap_td]:border [&_.tiptap_td]:border-border [&_.tiptap_td]:p-2 [&_.tiptap_th]:border [&_.tiptap_th]:border-border [&_.tiptap_th]:bg-muted [&_.tiptap_th]:p-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-6"
      />
    </div>
  );
}

export function migratePreparationMath(editor: Editor) {
  migrateMathStrings(editor);
}

export function replacePreparationMarkdown(editor: Editor, value: string) {
  editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  migratePreparationMath(editor);
}

export function imageFiles(files: FileList | null | undefined): File[] {
  return files ? Array.from(files).filter((file) => file.type.startsWith('image/')) : [];
}

export function isProtectedEditorAssetReference(
  value: ProtectedEditorAssetReference,
): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value.assetId)
    && /^\/api\/[A-Za-z0-9._~:/%+-]+$/.test(value.href);
}

export async function insertProtectedEditorImages(
  editor: Pick<Editor, 'chain'>,
  files: File[],
  uploadImage: ProtectedEditorImageUpload,
  callbacks: {
    onPendingChange?: (delta: 1 | -1) => void;
    onError?: (message: string | null) => void;
  } = {},
): Promise<void> {
  callbacks.onError?.(null);
  files.forEach(() => callbacks.onPendingChange?.(1));
  for (const file of files) {
    try {
      const asset = await uploadImage(file);
      if (!isProtectedEditorAssetReference(asset)) {
        throw new Error('invalid-protected-asset-reference');
      }
      editor.chain().focus().setImage({
        src: asset.href,
        alt: asset.altText?.trim() || file.name,
        title: `asset:${asset.assetId}`,
      }).run();
    } catch {
      callbacks.onError?.(`图片“${file.name}”上传失败，本地内容仍保留。`);
    } finally {
      callbacks.onPendingChange?.(-1);
    }
  }
}

function ToolbarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-md ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-background'}`}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{children}</span>
    </button>
  );
}

export const PREPARATION_EDITOR_DEPENDENCY_DECISION = {
  package: '@tiptap/react',
  version: '3.28.0',
  canonicalFormat: 'markdown',
  supported: ['headings', 'tables', 'inline-math', 'images', 'code-blocks', 'lists'],
} as const;
