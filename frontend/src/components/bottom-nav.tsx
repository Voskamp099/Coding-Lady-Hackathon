'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, logoutUser } from '@/lib/store';

const navItems = [
  {
    href: '/feed',
    label: '投喂',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5Z" />
        <circle cx="18" cy="6" r="1.5" fill="currentColor" />
        <circle cx="5" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/mirror',
    label: '镜像',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="8" r="3" />
        <path d="M6 18c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    ),
  },
  {
    href: '/growth',
    label: '成长',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V8" />
        <path d="M12 8C12 5 9 3 6 3C6 6 9 8 12 8Z" />
        <path d="M12 8C12 5 15 3 18 3C18 6 15 8 12 8Z" />
        <path d="M12 14C12 11 9 9 6 9C6 12 9 14 12 14Z" />
        <path d="M12 14C12 11 15 9 18 9C18 12 15 14 12 14Z" />
      </svg>
    ),
  },
  {
    href: '/chat',
    label: '对话',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <circle cx="8" cy="10" r="0.5" fill="currentColor" />
        <circle cx="12" cy="10" r="0.5" fill="currentColor" />
        <circle cx="16" cy="10" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
];

const ACTIVE_COLOR = '#C4A35A';
const INACTIVE_COLOR = '#8B7B65';

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = typeof window !== 'undefined' ? getUser() : null;

  const handleSwitchAccount = () => {
    if (confirm('确定要切换账户吗？当前数据会按名字安全保留。')) {
      logoutUser();
    }
  };

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-20 flex-col items-center py-8 z-40 glass-warm">
        <div className="mb-12">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #D4C88E, #C4A35A)', boxShadow: '0 2px 12px rgba(196,163,90,0.25)' }}>
            <div className="w-3 h-3 rounded-full bg-white/90" />
          </div>
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5 py-4 px-3 rounded-2xl transition-all duration-300"
              style={{
                color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR + '99',
                background: isActive ? 'rgba(212,200,142,0.3)' : 'transparent',
              }}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
        {/* Account / Switch — bottom of sidebar */}
        <div className="mt-auto">
          <button
            onClick={handleSwitchAccount}
            className="flex flex-col items-center gap-1.5 py-3 px-3 rounded-2xl transition-all duration-300 hover:bg-white/20"
            style={{ color: INACTIVE_COLOR + '99' }}
            title={user ? `${user.parentName} → ${user.childName}\n点击切换账户` : '切换账户'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px] font-medium">{user?.parentName?.[0] || '我'}</span>
          </button>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-warm" style={{ borderTop: '1px solid rgba(196,163,90,0.1)' }}>
        <div className="flex justify-around items-center py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
              >
                <div
                  className="flex flex-col items-center gap-1 px-6 py-1.5 rounded-2xl transition-all duration-300"
                  style={{ color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR + '99' }}
                >
                  <div style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(196,163,90,0.35))' } : {}}>
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
