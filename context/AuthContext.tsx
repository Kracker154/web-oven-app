// context/AuthContext.tsx
"use client";

import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebaseClient";
import { doc, onSnapshot } from "firebase/firestore";

// Define the shape of our User object
export interface AppUser {
  uid: string;
  email: string | null;
  name: string;
  isAdmin: boolean;
}

// Define the shape of the context value
interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser: FirebaseUser | null) => {
      if (authUser) {
        // User is signed in. Listen for real-time updates to their user document.
        const userRef = doc(db, "users", authUser.uid);
        
        const unsubDoc = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setUser({ 
              uid: authUser.uid, 
              email: authUser.email, 
              name: data.name,
              isAdmin: data.isAdmin,
            });
          }
          setLoading(false);
        });
        return () => unsubDoc(); // Cleanup snapshot listener

      } else {
        // User is signed out
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = { user, loading };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

// Custom hook for easy context access
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};