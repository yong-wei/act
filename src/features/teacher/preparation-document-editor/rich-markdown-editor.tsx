'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mathematics } from '@tiptap/extension-mathematics';
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
  Sigma,
  Table2,
} from 'lucide-react';

export const PREPARATION_MARKDOWN_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
  TableKit.configure({ table: { resizable: false } }),
  Mathematics,
  Markdown.configure({ markedOptions: { gfm: true, breaks: false } }),
];

export function RichMarkdownEditor({
  value,
  onChange,
  readOnly = false,
  ariaLabel = '文档正文',
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  ariaLabel?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: PREPARATION_MARKDOWN_EXTENSIONS,
    content: value,
    contentType: 'markdown',
    editable: !readOnly,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        class: 'min-h-[32rem] max-w-none px-5 py-6 text-[15px] leading-7 outline-none',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getMarkdown()),
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || editor.getMarkdown() === value) return;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
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
        </div>
      ) : null}
      <EditorContent
        editor={editor}
        className="[&_.tiptap>blockquote]:border-l-4 [&_.tiptap>blockquote]:pl-4 [&_.tiptap>h1]:text-3xl [&_.tiptap>h1]:font-semibold [&_.tiptap>h2]:mt-6 [&_.tiptap>h2]:text-2xl [&_.tiptap>h2]:font-semibold [&_.tiptap>h3]:mt-5 [&_.tiptap>h3]:text-xl [&_.tiptap>h3]:font-semibold [&_.tiptap>ol]:list-decimal [&_.tiptap>ol]:pl-6 [&_.tiptap>pre]:overflow-auto [&_.tiptap>pre]:rounded-lg [&_.tiptap>pre]:bg-muted [&_.tiptap>pre]:p-4 [&_.tiptap>table]:w-full [&_.tiptap>table]:border-collapse [&_.tiptap_td]:border [&_.tiptap_td]:border-border [&_.tiptap_td]:p-2 [&_.tiptap_th]:border [&_.tiptap_th]:border-border [&_.tiptap_th]:bg-muted [&_.tiptap_th]:p-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-6"
      />
    </div>
  );
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
  supported: ['headings', 'tables', 'inline-math', 'code-blocks', 'lists'],
} as const;
