import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  LayoutDashboard, Users, ShieldAlert, Flag, Settings, LogOut, Shield, Briefcase, Beaker, Menu, X, Image, Palette, Headphones, Tag, BarChart3, DollarSign, Megaphone,
} from 'lucide-react';

const allNavItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/admin/dashboard', roles: ['admin'] },
  { icon: Users, label: 'Users', path: '/admin/users', roles: ['admin'] },
  { icon: Briefcase, label: 'Jobs', path: '/admin/jobs', roles: ['admin'] },
  { icon: Image, label: 'Media', path: '/admin/media', roles: ['admin'] },
  { icon: ShieldAlert, label: 'Moderation', path: '/admin/moderation', roles: ['admin'] },
  { icon: Flag, label: 'Reports', path: '/admin/reports', roles: ['admin'] },
  { icon: Headphones, label: 'Support', path: '/admin/support', roles: ['admin', 'support'] },
  { icon: Tag, label: 'Promos', path: '/admin/promos', roles: ['admin'] },
  { icon: BarChart3, label: 'Stats', path: '/admin/stats', roles: ['admin'] },
  { icon: DollarSign, label: 'Revenue', path: '/admin/revenue', roles: ['admin'] },
  { icon: DollarSign, label: 'Pricing', path: '/admin/pricing', roles: ['admin'] },
  { icon: Megaphone, label: 'Marketing', path: '/admin/marketing', roles: ['admin'] },
  { icon: Beaker, label: 'Testing', path: '/admin/testing', roles: ['admin'] },
  { icon: Palette, label: 'Themes', path: '/admin/themes', roles: ['admin'] },
  { icon: Settings, label: 'Settings', path: '/admin/settings', roles: ['admin'] },
];

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminRole = admin?.role || 'admin';
  const navItems = allNavItems.filter(item => item.roles.includes(adminRole));

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed h-full z-50 bg-gray-900 border-r border-gray-800 flex flex-col
        w-64 transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 sm:p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h1 className="font-bold text-white text-lg">Hireabble</h1>
                <p className="text-xs text-gray-500">{adminRole === 'support' ? 'Support Panel' : 'Admin Panel'}</p>
              </div>
            </div>
            <button onClick={closeSidebar} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 lg:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {admin?.name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{admin?.name}</p>
              <p className="text-xs text-gray-500 truncate">{admin?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 w-full transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="font-bold text-white text-sm">Admin</span>
          </div>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
