import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { PageFloatingControlsProvider } from '@/components/shared/page-floating-controls'
import { getServerAuthSession } from '@/lib/auth'
import { buildThemeInitScript } from '@/lib/theme-config'
import { GlobalAIProvider } from '@/components/providers/global-ai-provider'
import { GlobalAIFloatingButton } from '@/components/ai/global-ai-button'
import { GlobalAISidebar } from '@/components/ai/global-ai-sidebar'

export const metadata: Metadata = {
  title: '智控深蓝',
  description: '基于学科垂类大模型的船舶智控教学平台',
}

export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
  textbookModal,
}: {
  children: React.ReactNode
  textbookModal: React.ReactNode
}) {
  const session = await getServerAuthSession()

  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script id="theme-init">{buildThemeInitScript()}</script>
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider session={session}>
            <GlobalAIProvider>
              <PageFloatingControlsProvider>
                {children}
                {textbookModal}
                <GlobalAIFloatingButton />
                <GlobalAISidebar />
              </PageFloatingControlsProvider>
            </GlobalAIProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
