import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  Users,
  ClipboardList,
  Sparkles,
  Boxes,
  Clock3,
  FileText,
  TrendingUp,
  Globe2,
  LogOut,
  Settings,
  Database,
  BarChart3,
  ShieldCheck,
  PackageCheck,
  Bell,
  Gauge,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import { getSessionWithFreshRoles } from '@/lib/auth';

type NavItem = [label: string, href: string, Icon: LucideIcon];

type NavGroup = {
  title: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    title: 'Workspace',
    items: [
      ['Dashboard', '/dashboard', Home],
      ['Resources', '/resources', Users],
      ['Requirements', '/requirements', ClipboardList],
      ['AI Matching', '/matching', Sparkles],
      ['Allocations', '/allocations', Boxes],
      ['Capacity & Bench', '/capacity', Gauge],
    ],
  },
  {
    title: 'Operations',
    items: [
      ['Timesheets', '/timesheets', Clock3],
      ['SOW & Contracts', '/sow', FileText],
      ['Pipeline & Forecast', '/pipeline', TrendingUp],
      ['External & PO Readiness', '/external', Globe2],
      ['Releases & Assets', '/releases', PackageCheck],
      ['Assets', '/assets', PackageCheck],
    ],
  },
  {
    title: 'Platform',
    items: [
      ['Power BI', '/powerbi', BarChart3],
      ['Integrations', '/integrations', Database],
      ['Notifications', '/notifications', Bell],
      ['Audit', '/audit', ShieldCheck],
      ['Admin / 41 Tables', '/admin', Settings],
    ],
  },
];

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionWithFreshRoles();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">dT</div>

          <div>
            <strong>diTrinity IRMS</strong>
            <small>Resource &amp; Operations</small>
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <div className="nav-section">{g.title}</div>

            {g.items.map(([label, href, Icon]) => (
              <Link
                key={href}
                className="nav-item"
                href={href}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </div>
        ))}

        <div className="sidebar-bottom">
          <strong>Production guardrails</strong>

          <p>
            No seed/demo data. Protected transitions are server-side.
            Configure Entra, integrations and Power BI before production.
          </p>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div className="crumb">
            Internal Resource Management System
          </div>

          <div className="top-actions">
            <input
              className="search"
              placeholder="Search employees, modules…"
            />

            <div className="avatar">
              {session.name.slice(0, 1).toUpperCase()}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {session.name}

              <div
                style={{
                  fontSize: 9,
                  color: '#8a95a4',
                  fontWeight: 500,
                }}
              >
                {session.roles.join(' · ') || 'User'}
              </div>
            </div>

            <a
              className="btn"
              href="/api/auth/logout"
            >
              Sign out <LogOut size={12} />
            </a>
          </div>
        </header>

        <main className="content">
          {children}
        </main>
      </section>
    </div>
  );
}