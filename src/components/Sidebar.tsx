import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users2,
  Receipt,
  Landmark,
  FileBarChart2,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const navigationItems = [
  {
    name: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    description: 'Financial Overview',
  },
  {
    name: 'Khata',
    to: '/khata',
    icon: Users2,
    description: 'Given & Received Ledger',
  },
  {
    name: 'Expenses',
    to: '/expenses',
    icon: Receipt,
    description: 'Personal Spending',
  },
  {
    name: 'Long-Term Loans',
    to: '/loans',
    icon: Landmark,
    description: 'Loans & Repayments',
  },
  {
    name: 'Reports & PDF',
    to: '/reports',
    icon: FileBarChart2,
    description: 'Analytics & Statements',
  },
  {
    name: 'Settings',
    to: '/settings',
    icon: Settings,
    description: 'Security & PINs',
  },
];

export const Sidebar: React.FC = () => {
  const { pinStatus } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 min-h-[calc(100vh-4rem)] p-4 justify-between transition-colors">
      <div className="space-y-6">
        {/* Navigation list */}
        <nav className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div className="flex-1">
                  <span>{item.name}</span>
                </div>
              </NavLink>
            );
          })}
        </nav>

        {/* Security Summary Badge */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold">Security Protection</span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Transaction PIN:</span>
              <span className={`font-semibold ${pinStatus.hasAppPin ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {pinStatus.hasAppPin ? 'Active' : 'Unset'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Login PIN:</span>
              <span className={`font-semibold ${pinStatus.hasLoginPin ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                {pinStatus.hasLoginPin ? 'Active' : 'Unset'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>UTR Duplicate Lock:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Enforced</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
          NEXMONEY is a personal finance management tool. Not a licensed bank or UPI payment provider.
        </p>
      </div>
    </aside>
  );
};

export const MobileNav: React.FC = () => {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around transition-colors">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="mt-0.5 truncate max-w-[55px] text-center">{item.name.split(' ')[0]}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
