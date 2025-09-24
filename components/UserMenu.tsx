import React, { useState, useRef, useEffect } from 'react';
import { useKanbanStore } from '../hooks/useKanbanStore';
import Avatar from './Avatar';
import { MemberRole } from '../types';
import ProfileModal from './ProfileModal';

interface UserMenuProps {
    onAdminPanelClick: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onAdminPanelClick }) => {
  const { currentUser, signOut } = useKanbanStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser) return null;

  return (
    <>
      <div className="relative" ref={wrapperRef}>
        <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2">
          <Avatar member={currentUser} size="lg" />
        </button>
        {isOpen && (
          <div className="absolute z-30 mt-2 w-56 origin-top-right right-0 bg-white border border-gray-200 rounded-md shadow-lg py-1">
            <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold truncate">{currentUser.name}</p>
                <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
            </div>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setIsProfileModalOpen(true); setIsOpen(false); }}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Profilim
            </a>
            {currentUser.role === MemberRole.ADMIN && (
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onAdminPanelClick(); setIsOpen(false); }}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Yönetici Paneli
              </a>
            )}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); signOut(); setIsOpen(false); }}
              className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Çıkış Yap
            </a>
          </div>
        )}
      </div>
      {isProfileModalOpen && <ProfileModal onClose={() => setIsProfileModalOpen(false)} />}
    </>
  );
};

export default UserMenu;
