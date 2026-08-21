import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { fetchUsuarioFirestore } from '../lib/firestoreServices';

export type AuthRuntimeContext = {
  firebaseUser: User | null;
  user: Record<string, any> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
};

const AuthRuntime = createContext<AuthRuntimeContext | null>(null);

/**
 * Provider mínimo e canônico para os componentes que dependem de `useAuth`.
 * A autorização continua sendo validada no Firestore pelas telas/serviços;
 * este provider não cria perfil, não simula role e não faz fallback local.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setFirebaseUser(nextUser);
    setIsLoading(true);
    if (!nextUser) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setUser(await fetchUsuarioFirestore(nextUser.uid));
    } catch (error) {
      console.error('[AuthProvider] Não foi possível carregar o perfil Firestore.', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }), []);

  const value = useMemo<AuthRuntimeContext>(() => ({
    firebaseUser,
    user,
    isAuthenticated: Boolean(firebaseUser && user),
    isLoading,
    logout: async () => { await signOut(auth); },
  }), [firebaseUser, user, isLoading]);

  return <AuthRuntime.Provider value={value}>{children}</AuthRuntime.Provider>;
}

export function useAuth(): AuthRuntimeContext {
  const context = useContext(AuthRuntime);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}

export * from './profile';
export * from './types/auth';
