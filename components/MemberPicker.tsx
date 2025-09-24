
import React, { useState, useRef, useEffect } from 'react';
import { Member, ID } from '../types';
import Avatar from './Avatar';

interface MemberPickerProps {
    allMembers: Member[];
    selectedIds: ID[];
    onChange: (selectedIds: ID[]) => void;
    readOnly?: boolean;
}

const MemberPicker: React.FC<MemberPickerProps> = ({ allMembers, selectedIds, onChange, readOnly = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedMembers = allMembers.filter(m => selectedIds.includes(m.id));
    const availableMembers = allMembers.filter(m => !selectedIds.includes(m.id));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (memberId: ID) => {
        onChange([...selectedIds, memberId]);
    };

    const handleDeselect = (memberId: ID) => {
        onChange(selectedIds.filter(id => id !== memberId));
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className={`flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md min-h-[42px] ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
                {selectedMembers.length === 0 && readOnly && (
                    <span className="text-sm text-gray-500 p-1">Atanan yok.</span>
                )}
                {selectedMembers.map(member => (
                    <div key={member.id} className="flex items-center bg-white rounded-full px-2 py-1 border border-gray-200">
                        <Avatar member={member} size="sm" />
                        <span className="text-sm ml-1.5">{member.name}</span>
                        {!readOnly && (
                            <button type="button" onClick={() => handleDeselect(member.id)} className="ml-1.5 text-gray-500 hover:text-gray-700">
                                &times;
                            </button>
                        )}
                    </div>
                ))}
                {!readOnly && (
                    <button type="button" onClick={() => setIsOpen(!isOpen)} className="text-blue-500 hover:text-blue-700 text-sm p-1">
                        + Ekle
                    </button>
                )}
            </div>
            {isOpen && !readOnly && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {availableMembers.length > 0 ? availableMembers.map(member => (
                        <div key={member.id} onClick={() => { handleSelect(member.id); setIsOpen(false); }} className="flex items-center px-4 py-2 cursor-pointer hover:bg-gray-100">
                            <Avatar member={member} size="md" />
                            <span className="ml-3">{member.name}</span>
                        </div>
                    )) : <div className="px-4 py-2 text-gray-500">Tüm üyeler atandı.</div>}
                </div>
            )}
        </div>
    );
};

export default MemberPicker;