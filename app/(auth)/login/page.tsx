// app/(auth)/login/page.tsx (The new, improved version)
"use client";
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Box } from 'lucide-react'; // An icon for flair

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Logged in successfully!');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message || "Failed to login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // This is the main container that creates the background and centers the content
    <div className="flex items-center justify-center min-h-screen bg-gray-100">

      {/* This is the login card: compact, white, with shadow and padding */}
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">

        {/* Header Section */}
        <div className="text-center">
          <Box className="mx-auto h-12 w-auto text-blue-600" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">OvenBook</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to schedule your equipment</p>
        </div>

        {/* The Form Itself */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email Input Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
            />
          </div>

          {/* Password Input Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input 
              id="password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
            />
          </div>

          {/* Login Button */}
          <button 
            type="submit" 
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400" 
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Link to Register Page */}
        <p className="text-center text-sm text-gray-600">
          Not a member?{' '}
          <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}