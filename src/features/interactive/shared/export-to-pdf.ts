'use client';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportElementToPdf({
  title,
  element,
}: {
  title: string;
  element: HTMLElement | null;
}) {
  if (!element || typeof window === 'undefined') {
    return;
  }

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900');
  if (!printWindow) {
    return;
  }

  const currentTheme = document.documentElement.classList.contains('light') ? 'light' : '';
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${styles}
    <style>
      @page {
        size: A4;
        margin: 14mm;
      }

      html, body {
        margin: 0;
        padding: 0;
      }

      body {
        background: white;
        color: #0f172a;
        font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      }

      .pdf-shell {
        max-width: 980px;
        margin: 0 auto;
        padding: 24px;
      }

      .pdf-shell .no-print {
        display: none !important;
      }

      @media print {
        body {
          background: white !important;
        }

        .pdf-shell {
          max-width: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body class="${currentTheme}">
    <main class="pdf-shell">${element.outerHTML}</main>
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => {
          window.print();
          window.addEventListener('afterprint', () => window.close(), { once: true });
        }, 180);
      });
    </script>
  </body>
</html>`);
  printWindow.document.close();
}
