import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/auth-context'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { ApiLoadingIndicator } from '@/components/ui/api-loading-indicator'
import '../globals.css'

export const metadata: Metadata = {
  title:       'OTS 翻譯服務 | 木典股份有限公司',
  description: '台語、客語、原住民族語 AI 輔助文學翻譯服務',
}

export default async function RootLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode,
  params: { locale: string }
}) {
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>{children}</AuthProvider>
          <ApiLoadingIndicator />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
