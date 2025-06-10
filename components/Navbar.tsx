// components/Navbar.tsx
"use client";
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebaseClient';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { LogOut, LayoutDashboard, UserCog } from 'lucide-react';

export default function Navbar() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">OvenBook</Link>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-gray-700 hidden sm:block">Welcome, {user.name}</span>
                {user.isAdmin && (
                  <Link href="/admin" className="text-gray-600 hover:text-blue-600 p-2 rounded-md hover:bg-gray-100" title="Admin Panel">
                    <UserCog className="h-5 w-5" />
                  </Link>
                )}
                <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 p-2 rounded-md hover:bg-gray-100" title="Dashboard">
                  <LayoutDashboard className="h-5 w-5" />
                </Link>
                <button onClick={handleLogout} className="text-gray-600 hover:text-blue-600 p-2 rounded-md hover:bg-gray-100" title="Logout">
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-600 hover:text-blue-600">Login</Link>
                <Link href="/register" className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}