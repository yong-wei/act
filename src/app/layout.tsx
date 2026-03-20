import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { ThemeToggleButton } from '@/components/shared/theme-toggle-button'
import { getServerAuthSession } from '@/lib/auth'
import { buildThemeInitScript } from '@/lib/theme-config'
import { GlobalAIProvider } from '@/components/providers/global-ai-provider'
import { GlobalAIFloatingButton } from '@/components/ai/global-ai-button'
import { GlobalAISidebar } from '@/components/ai/global-ai-sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI-OBE船舶控制平台',
  description: '智能海事教育平台 - AI驱动的船舶控制与PID参数优化系统',
}

export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerAuthSession()

  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <SessionProvider session={session}>
            <GlobalAIProvider>
              {children}
              <ThemeToggleButton />
              <GlobalAIFloatingButton />
              <GlobalAISidebar />
            </GlobalAIProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
