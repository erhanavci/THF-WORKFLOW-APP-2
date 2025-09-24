import React, { useState, useEffect, useRef } from 'react';
import Modal from './ui/Modal';
import { useKanbanStore } from '../hooks/useKanbanStore';
import { AllTaskStatuses, Member, MemberRole, TaskStatus } from '../types';
import { useToast } from '../hooks/useToast';
import Avatar from './Avatar';

interface AdminPanelModalProps {
  onClose: () => void;
}

type AdminTab = 'dashboard' | 'team' | 'board' | 'data';

const TeamManagement: React.FC = () => {
    const { members, addMember, updateMember, deleteMember, currentUser } = useKanbanStore();
    const { showToast } = useToast();

    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
    const [newAvatarPreviewUrl, setNewAvatarPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberRole, setNewMemberRole] = useState<MemberRole>(MemberRole.MEMBER);
    const [newMemberPassword, setNewMemberPassword] = useState('');


    const handleAddMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberName.trim()) {
            showToast('Üye adı gereklidir.', 'error');
            return;
        }
        if (!newMemberEmail.trim() || !/^\S+@\S+\.\S+$/.test(newMemberEmail)) {
            showToast('Geçerli bir e-posta adresi gereklidir.', 'error');
            return;
        }
        if (!newMemberPassword.trim()) {
            showToast('Şifre gereklidir.', 'error');
            return;
        }

        addMember({
            name: newMemberName,
            email: newMemberEmail,
            role: newMemberRole,
            password: newMemberPassword,
            avatarUrl: `https://i.pravatar.cc/150?u=${crypto.randomUUID()}`,
        });
        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberRole(MemberRole.MEMBER);
        setNewMemberPassword('');
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setNewAvatarFile(file);
            if (newAvatarPreviewUrl) {
                URL.revokeObjectURL(newAvatarPreviewUrl);
            }
            setNewAvatarPreviewUrl(URL.createObjectURL(file));
        } else if (file) {
            showToast("Lütfen geçerli bir resim dosyası seçin.", "error");
        }
        e.target.value = '';
    };
    
    const cancelEditing = () => {
        setEditingMember(null);
        if (newAvatarPreviewUrl) {
            URL.revokeObjectURL(newAvatarPreviewUrl);
        }
        setNewAvatarFile(null);
        setNewAvatarPreviewUrl(null);
    };

    const handleUpdateMember = () => {
        if (editingMember && editingMember.name.trim() && /^\S+@\S+\.\S+$/.test(editingMember.email)) {
            updateMember(editingMember, newAvatarFile ?? undefined);
            cancelEditing();
        } else {
            showToast('Üye adı ve geçerli bir e-posta adresi gereklidir.', 'error');
        }
    };

    const handleInputChange = (field: keyof Member, value: string) => {
        if (editingMember) {
            setEditingMember({ ...editingMember, [field]: value });
        }
    };
    
    const handleDeleteClick = (member: Member) => {
        if (member.id === currentUser?.id) {
            showToast("Kendinizi silemezsiniz.", "error");
            return;
        }
        if (window.confirm(`${member.name} adlı üyeyi kaldırmak istediğinizden emin misiniz? Bu işlem, üyeyi sadece pano veritabanından kaldırır, giriş sisteminden değil.`)) {
            deleteMember(member.id);
        }
    };

    return (
        <div className="space-y-6">
            <input type="file" accept="image/png, image/jpeg, image/gif" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" />
            <div>
                <h3 className="text-lg font-medium text-gray-800">Takım Üyeleri</h3>
                <ul className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2">
                    {members.map(member => (
                        <li key={member.id} className="flex items-center justify-between p-2 bg-white rounded-md gap-2 border border-gray-200">
                            {editingMember?.id === member.id ? (
                                <>
                                    <div className="flex-grow flex items-center gap-2">
                                        <div className="relative group shrink-0">
                                            <Avatar member={editingMember} size="md" srcOverride={newAvatarPreviewUrl} />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="absolute inset-0 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                                                aria-label="Profil resmini değiştir"
                                            >
                                                Değiştir
                                            </button>
                                        </div>
                                        <div className="flex-grow space-y-1">
                                            <input type="text" value={editingMember.name} onChange={(e) => handleInputChange('name', e.target.value)} className="block w-full px-2 py-1 border border-gray-300 rounded-md bg-gray-50 text-sm" placeholder="İsim" />
                                            <input type="email" value={editingMember.email} readOnly className="block w-full px-2 py-1 border border-gray-300 rounded-md bg-gray-100 text-sm cursor-not-allowed" placeholder="E-posta" />
                                        </div>
                                    </div>
                                    <div className="w-32 shrink-0">
                                        <select
                                            value={editingMember.role}
                                            onChange={(e) => handleInputChange('role', e.target.value)}
                                            className="block w-full px-2 py-1 border border-gray-300 rounded-md bg-gray-50 text-xs"
                                            disabled={editingMember.id === currentUser?.id}
                                        >
                                            <option value={MemberRole.ADMIN}>Yönetici</option>
                                            <option value={MemberRole.MEMBER}>Üye</option>
                                        </select>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-grow flex items-center gap-3">
                                    <Avatar member={member} size="md" />
                                    <div>
                                        <p className="font-semibold">{member.name} {member.id === currentUser?.id && <span className="text-xs text-blue-500">(Siz)</span>}</p>
                                        <p className="text-sm text-gray-500">{member.email}</p>
                                        <p className="text-sm text-gray-500">{member.role}</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2 shrink-0">
                                {editingMember?.id === member.id ? (
                                    <>
                                        <button onClick={handleUpdateMember} className="text-green-500 hover:text-green-700 font-semibold">Kaydet</button>
                                        <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700">İptal</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => setEditingMember(member)} className="text-blue-500 hover:text-blue-700">Düzenle</button>
                                        <button onClick={() => handleDeleteClick(member)} className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed" disabled={member.id === currentUser?.id}>Sil</button>
                                    </>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <h3 className="text-lg font-medium text-gray-800">Yeni Üye Ekle</h3>
                <form onSubmit={handleAddMember} className="mt-4 flex flex-col sm:flex-row gap-4 flex-wrap items-start">
                    <input type="text" placeholder="İsim" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} className="flex-grow px-3 py-2 border border-gray-300 rounded-md bg-gray-50" />
                    <input type="email" placeholder="E-posta" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} className="flex-grow px-3 py-2 border border-gray-300 rounded-md bg-gray-50" />
                    <input type="password" placeholder="Şifre" value={newMemberPassword} onChange={(e) => setNewMemberPassword(e.target.value)} className="flex-grow px-3 py-2 border border-gray-300 rounded-md bg-gray-50" />
                    <select
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
                        className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    >
                        <option value={MemberRole.MEMBER}>Üye</option>
                        <option value={MemberRole.ADMIN}>Yönetici</option>
                    </select>
                    <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">Üye Ekle</button>
                </form>
            </div>
        </div>
    );
};

const BoardSettings: React.FC = () => {
    const { columnNames, updateColumnNames } = useKanbanStore();
    const [localNames, setLocalNames] = useState(columnNames);

    const handleSaveSettings = () => {
        updateColumnNames(localNames);
    };
    
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-800">Sütun İsimleri</h3>
                <p className="text-sm text-gray-500">Panonuzdaki sütunların adlarını özelleştirin.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {AllTaskStatuses.map(status => (
                        <div key={status}>
                            <label htmlFor={`col-${status}`} className="block text-sm font-medium text-gray-700">{status}</label>
                            <input
                                id={`col-${status}`}
                                type="text"
                                value={localNames[status]}
                                onChange={(e) => setLocalNames(prev => ({ ...prev, [status]: e.target.value }))}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                            />
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="flex justify-end pt-6 border-t border-gray-200">
                <button onClick={handleSaveSettings} className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">Ayarları Kaydet</button>
            </div>
        </div>
    );
}

const DataManagement: React.FC<{onClose: () => void}> = ({onClose}) => {
    const { clearAllTasks, resetBoard } = useKanbanStore();

    const handleClearTasks = () => {
        if (window.confirm('Tüm görevleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
            clearAllTasks();
        }
    };

    const handleResetBoard = () => {
        if (window.confirm('Tüm panoyu sıfırlamak istediğinizden emin misiniz? Bu, tüm görevleri ve üyeleri silecek ve başlangıçtaki örnek verileri geri yükleyecektir.')) {
            resetBoard().then(() => {
                onClose();
            });
        }
    };

    return (
        <div className="p-4 border border-red-300 rounded-lg">
            <h3 className="text-lg font-medium text-red-700">Tehlikeli Bölge</h3>
            <p className="text-sm text-gray-500 mt-1">Bu işlemler geri alınamaz. Lütfen dikkatli olun.</p>
            <div className="mt-4 flex flex-col md:flex-row gap-4">
                <button onClick={handleClearTasks} className="px-4 py-2 w-full text-white bg-red-600 rounded-md hover:bg-red-700">Tüm Görevleri Temizle</button>
                <button onClick={handleResetBoard} className="px-4 py-2 w-full text-white bg-red-800 rounded-md hover:bg-red-900">Panoyu Varsayılana Sıfırla</button>
            </div>
        </div>
    );
};

const Dashboard: React.FC = () => {
    const { tasks, members, columnNames } = useKanbanStore();
    const tasksByStatus = AllTaskStatuses.reduce((acc, status) => {
        acc[status] = tasks.filter(t => t.status === status).length;
        return acc;
    }, {} as Record<TaskStatus, number>);

    return (
         <div>
            <h3 className="text-lg font-medium text-gray-800 mb-4">Pano Genel Bakışı</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <p className="text-3xl font-bold">{tasks.length}</p>
                    <p className="text-sm text-gray-500">Toplam Görev</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <p className="text-3xl font-bold">{members.length}</p>
                    <p className="text-sm text-gray-500">Takım Üyeleri</p>
                </div>
            </div>
             <div className="mt-6">
                 <h4 className="font-medium mb-2">Sütun Başına Görevler</h4>
                 <div className="space-y-2">
                     {AllTaskStatuses.map(status => (
                         <div key={status}>
                             <div className="flex justify-between mb-1">
                                 <span className="text-sm font-medium text-gray-700">{columnNames[status]}</span>
                                 <span className="text-sm font-medium text-gray-500">{tasksByStatus[status]}</span>
                             </div>
                             <div className="w-full bg-gray-200 rounded-full h-2.5">
                                 <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: tasks.length > 0 ? `${(tasksByStatus[status] / tasks.length) * 100}%` : '0%' }}></div>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
        </div>
    )
}

const AdminPanelModal: React.FC<AdminPanelModalProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

    const tabs: {id: AdminTab, label: string}[] = [
        { id: 'dashboard', label: 'Gösterge Paneli' },
        { id: 'team', label: 'Takım Yönetimi' },
        { id: 'board', label: 'Pano Ayarları' },
        { id: 'data', label: 'Veri Yönetimi' },
    ];

    const renderContent = () => {
        switch(activeTab) {
            case 'dashboard': return <Dashboard />;
            case 'team': return <TeamManagement />;
            case 'board': return <BoardSettings />;
            case 'data': return <DataManagement onClose={onClose} />;
            default: return null;
        }
    }

    return (
        <Modal isOpen onClose={onClose} title="Yönetici Paneli" className="max-w-4xl">
            <div className="flex flex-col md:flex-row gap-8">
                <aside className="-ml-6 -mt-6 md:border-r border-b md:border-b-0 border-gray-200 p-6 md:w-1/4">
                    <nav className="flex md:flex-col gap-2">
                        {tabs.map(tab => (
                             <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 text-sm font-medium rounded-md text-left w-full ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                             >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </aside>
                <main className="flex-1">
                    {renderContent()}
                </main>
            </div>
        </Modal>
    );
};

export default AdminPanelModal;
