'use client';

export function DocumentGradingApprovalButton() {
  return (
    <span data-legacy-document-grading-approval-disabled="true">
      <button
        type="button"
        disabled
        title="旧审批接口已停用"
        className="rounded border border-border px-3 py-2 text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        审批不可用
      </button>
      <span className="ml-2 text-xs text-muted-foreground">旧审批接口已停用；当前草稿不会被自动审批或写回。</span>
    </span>
  );
}
