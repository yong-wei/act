'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, QrCode } from 'lucide-react';
import * as QRCode from 'qrcode/lib/browser';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function buildClassroomJoinUrl(joinCode: string, origin: string) {
  const url = new URL('/classroom/join', origin);
  url.searchParams.set('code', joinCode);
  return url.toString();
}

export function TeacherJoinQrDialog({
  joinCode,
  title = '课堂二维码',
}: {
  joinCode?: string | null;
  title?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const joinUrl = useMemo(() => {
    if (!joinCode || !origin) return null;
    return buildClassroomJoinUrl(joinCode, origin);
  }, [joinCode, origin]);
  const [qrState, setQrState] = useState(() => ({ joinUrl, dataUrl: null as string | null }));
  if (qrState.joinUrl !== joinUrl) {
    setQrState({ joinUrl, dataUrl: null });
  }

  useEffect(() => {
    let cancelled = false;
    if (!joinUrl) return undefined;

    void QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 240,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    }).then((dataUrl) => {
      if (!cancelled) {
        setQrState((current) => current.joinUrl === joinUrl ? { joinUrl, dataUrl } : current);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  const copyText = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(success);
    } catch {
      setNotice('复制失败，请手动记录。');
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        disabled={!joinCode}
        className="premium-lesson-action-secondary"
      >
        <QrCode className="h-4 w-4" />
        二维码
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>学生扫码后进入加入课堂页，并通过课堂码校验加入。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              {qrState.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrState.dataUrl} alt="课堂加入二维码" className="mx-auto h-60 w-60 rounded-lg bg-background p-2" />
              ) : (
                <div className="mx-auto flex h-60 w-60 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                  二维码生成中...
                </div>
              )}
              <div className="mt-3 font-mono text-2xl font-semibold tracking-[0.25em]">{joinCode ?? '------'}</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!joinCode}
                onClick={() => joinCode && void copyText(joinCode, '课堂码已复制')}
                className="btn-ghost-themed justify-center"
              >
                <Copy className="h-4 w-4" />
                复制课堂码
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!joinUrl}
                onClick={() => joinUrl && void copyText(joinUrl, '加入链接已复制')}
                className="btn-ghost-themed justify-center"
              >
                <Copy className="h-4 w-4" />
                复制链接
              </Button>
            </div>

            {joinUrl ? (
              <div className="break-all rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {joinUrl}
              </div>
            ) : null}
            {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
