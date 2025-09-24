export const formatDate = (isoString?: string): string => {
  if (!isoString) return 'Son tarih yok';
  return new Date(isoString).toLocaleDateString('tr-TR', {
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const isOverdue = (isoString?: string): boolean => {
  if (!isoString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Compare dates only
  return new Date(isoString) < today;
};

export const getDaysUntil = (isoString?: string): { text: string; color: string } | null => {
  if (!isoString) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(isoString);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)} gün gecikti`, color: 'text-red-600' };
  }
  if (diffDays === 0) {
    return { text: 'Bugün son', color: 'text-amber-600' };
  }
  if (diffDays <= 3) {
      return { text: `${diffDays} gün kaldı`, color: 'text-amber-600' };
  }
  return { text: `${diffDays} gün kaldı`, color: 'text-green-600' };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export const isThisWeek = (isoString?: string): boolean => {
  if (!isoString) return false;
  
  const dateToCheck = new Date(isoString);
  
  const today = new Date();
  const dayOfWeek = today.getDay(); // Sunday: 0, Monday: 1, ..., Saturday: 6
  
  const startOfWeek = new Date(today);
  // Adjust to Monday
  const dayOfMonth = today.getDate();
  const dayAdjustment = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(dayOfMonth + dayAdjustment);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return dateToCheck >= startOfWeek && dateToCheck <= endOfWeek;
};