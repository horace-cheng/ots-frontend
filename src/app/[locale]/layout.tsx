import type { Metadata } from 'next'
import { Noto_Serif_TC, Noto_Sans_TC } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import '../globals.css'

const display = Noto_Serif_TC({
  subsets:  ['latin'],
  weight:   ['400', '700'],
  variable: '--font-display',
})

const body = Noto_Sans_TC({
  subsets:  ['latin', 'latin-ext'],
  weight:   ['400', '500'],
  variable: '--font-body',
})

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
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
