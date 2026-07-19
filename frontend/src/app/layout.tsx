import type { Metadata, Viewport } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Time Mirror | 时光镜像',
    template: '%s | Time Mirror',
  },
  description: '用光种下一颗种子，让回忆陪伴成长。Time Mirror —— 为孩子留住每一个温暖的瞬间。',
  keywords: ['Time Mirror', '时光镜像', '数字分身', '童年回忆', 'AI陪伴'],
  authors: [{ name: 'Time Mirror' }],
  openGraph: {
    title: 'Time Mirror | 时光镜像',
    description: '用光种下一颗种子，让回忆陪伴成长。',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FFF8F0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
