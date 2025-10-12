import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { LogoutIcon, ProfileIcon } from './Icons';
import ProfileModal from './ProfileModal';

interface UserMenuProps {
    onSignOut: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onSignOut }) => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    const handleOpenProfile = () => {
        setIsProfileModalOpen(true);
        setIsOpen(false);
    };

    return (
        <>
            <div className="relative" ref={menuRef}>
                <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-2 rounded-full ring-2 ring-transparent hover:ring-primary transition-all">
                    <img src={user.picture} alt="User" className="w-8 h-8 rounded-full" />
                </button>
                {isOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-surface rounded-md shadow-lg py-1 z-50 border border-border">
                        <div className="px-4 py-2 border-b border-border">
                            <p className="text-sm font-semibold text-text-main">{user.name}</p>
                            <p className="text-xs text-text-muted truncate">{user.email}</p>
                        </div>
                        <button
                            onClick={handleOpenProfile}
                            className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface-hover flex items-center transition-colors"
                        >
                            <ProfileIcon />
                            <span className="ml-2">Profile</span>
                        </button>
                        <button
                            onClick={onSignOut}
                            className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-surface-hover flex items-center transition-colors"
                        >
                            <LogoutIcon />
                            <span className="ml-2">Sign Out</span>
                        </button>
                    </div>
                )}
            </div>
            <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
        </>
    );
};

export default UserMenu;