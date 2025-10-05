import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from './services/supabaseClient';
import { User } from './types';

interface AuthContextType {
    user: User | null;
    signOut: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        setIsLoading(true);
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && session.user) {
                setUser({
                    id: session.user.id,
                    name: session.user.user_metadata.full_name || session.user.user_metadata.name,
                    email: session.user.email!,
                    picture: session.user.user_metadata.avatar_url || session.user.user_metadata.picture,
                });
            } else {
                setUser(null);
            }
            setIsLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, signOut, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};