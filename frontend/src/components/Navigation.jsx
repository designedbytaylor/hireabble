import { Link, useLocation } from 'react-router-dom';
import { Home, Heart, User, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navigation() {
  const location = useLocation();
  const { user } = useAuth();
  
  const isSeeker = user?.role === 'seeker';
  
  const navItems = [
    { 
      icon: Home, 
      label: 'Home', 
      path: isSeeker ? '/dashboard' : '/recruiter' 
    },
    { 
      icon: Heart, 
      label: 'Matches', 
      path: '/matches' 
    },
    { 
      icon: User, 
      label: 'Profile', 
      path: '/profile' 
    },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="glass rounded-full px-6 py-3 flex items-center gap-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 transition-all ${
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <div className={`p-2 rounded-xl transition-all ${
                isActive ? 'bg-primary/20 neon-glow' : 'hover:bg-accent'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium hidden md:block">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
