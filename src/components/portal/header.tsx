'use client'
import { Link, useRouter, usePathname } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { useAuth } from '@/lib/auth-context'
import { logout } from '@/lib/firebase'

export function PortalHeader() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale })
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <span className="font-display" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)' }}>
            木典 <span style={{ color: 'var(--gold)' }}>OTS</span>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--mist)', borderLeft: '1px solid rgba(26,26,46,0.15)', paddingLeft: '0.75rem', display: 'none' }}
            className="sm-show">文學翻譯服務</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select 
            value={locale} 
            onChange={(e) => handleLocaleChange(e.target.value)}
            style={{ 
              fontSize: '0.8rem', 
              color: 'var(--ink)', 
              background: 'transparent',
              border: '1px solid rgba(138,155,181,0.5)',
              borderRadius: '4px',
              padding: '0.2rem 0.5rem',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="zh-TW">中文</option>
            <option value="en">English</option>
          </select>

          {user ? (
            <>
              <Link href="/orders" style={{ fontSize: '0.875rem', color: 'var(--mist)', textDecoration: 'none' }}
                onMouseOver={e => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseOut={e => (e.currentTarget.style.color = 'var(--mist)')}>
                我的訂單
              </Link>
              <button onClick={() => logout()} style={{ fontSize: '0.875rem', color: 'var(--mist)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                登出
              </button>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ padding: '0.375rem 0.875rem', fontSize: '0.8rem' }}>
              登入
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
