import React, { useState, useRef } from 'react';
import Modal from './ui/Modal';
import { useKanbanStore } from '../hooks/useKanbanStore';
import { Member } from '../types';
import Avatar from './Avatar';
import { useToast } from '../hooks/useToast';

interface ProfileModalProps {
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { currentUser, updateMember, notificationSettings, updateNotificationSettings } = useKanbanStore();
  const { showToast } = useToast();
  
  const [editableUser, setEditableUser] = useState<Member | null>(currentUser);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [newAvatarPreviewUrl, setNewAvatarPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editableUser) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditableUser({ ...editableUser, [name]: value });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editableUser.name.trim()) {
      showToast('İsim alanı boş bırakılamaz.', 'error');
      return;
    }
    
    updateMember(editableUser, newAvatarFile ?? undefined);
    onClose();
  };
  
  const handleToggleNotifications = () => {
      updateNotificationSettings({ enabled: !notificationSettings.enabled });
  }

  const inputStyles = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-gray-50";
  const labelStyles = "block text-sm font-medium text-gray-700";

  return (
    <Modal isOpen onClose={onClose} title="Profilimi Düzenle">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
             <div className="relative group">
                <Avatar member={editableUser} size="lg" srcOverride={newAvatarPreviewUrl} />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    aria-label="Profil resmini değiştir"
                >
                    Değiştir
                </button>
                <input type="file" accept="image/png, image/jpeg, image/gif" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" />
            </div>
            <h2 className="text-2xl font-bold">{editableUser.name}</h2>
            <p className="text-gray-500">{editableUser.email}</p>
        </div>

        <div className="pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Bildirim Ayarları</h3>
            <div className="flex items-center justify-between mt-4 bg-white p-4 rounded-lg border border-gray-200">
                <label htmlFor="notification-toggle" className="text-sm font-medium text-gray-700">
                    Uygulama içi bildirimleri etkinleştir
                </label>
                <button
                    type="button"
                    role="switch"
                    aria-checked={notificationSettings.enabled}
                    onClick={handleToggleNotifications}
                    className={`${notificationSettings.enabled ? 'bg-sky-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2`}
                >
                    <span
                        aria-hidden="true"
                        className={`${notificationSettings.enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                </button>
            </div>
        </div>
        
        <div className="space-y-4 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Kullanıcı Bilgileri</h3>
          <div>
            <label htmlFor="name" className={labelStyles}>İsim</label>
            <input type="text" id="name" name="name" value={editableUser.name} onChange={handleInputChange} className={inputStyles} />
          </div>
           <div>
            <label className={labelStyles}>Şifre</label>
            <p className="text-sm text-gray-500 mt-2">
              Şifrenizi değiştirmek için Firebase'in şifre sıfırlama özelliğini kullanın.
            </p>
          </div>
        </div>

        <footer className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
            İptal
          </button>
          <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg shadow-sm hover:bg-sky-700 transition-colors">
            Kaydet
          </button>
        </footer>
      </form>
    </Modal>
  );
};

export default ProfileModal;
