// components/AuthCheck.tsx (Corrected Version)
"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

interface AuthCheckProps {
    children: ReactNode;
    adminOnly?: boolean;
}

// The function signature was also a bit off in the screenshot, let's fix that too.
export default function AuthCheck({ children, adminOnly = false }: AuthCheckProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        if (!user) {
            router.push('/login');
            return;
        }

        // THE FIX: We want to redirect if the user IS NOT an admin.
        if (adminOnly && !user.isAdmin) {
            router.push('/dashboard');
            return;
        }
    }, [user, loading, adminOnly, router]);

    // The loading/redirecting condition also needs to be corrected.
    if (loading || !user || (adminOnly && !user.isAdmin)) {
        return <div className="text-center p-10">Loading or redirecting...</div>;
    }

    return <>{children}</>;
}