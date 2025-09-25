import React, { useEffect, useState } from 'react';
import Modal from './ui/Modal';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: { name: string; type: string; url: string } | null;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ isOpen, onClose, file }) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (file && file.type.startsWith('text/')) {
      setIsLoading(true);
      fetch(file.url)
        .then(response => response.text())
        .then(text => {
          setTextContent(text);
          setIsLoading(false);
        })
        .catch(() => {
          setTextContent('Dosya içeriği okunamadı.');
          setIsLoading(false);
        });
    } else {
        setTextContent(null);
    }
  }, [file]);

  if (!isOpen || !file) {
    return null;
  }

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = file.url;
    a.target = '_blank';
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderPreview = () => {
    if (isLoading) return <p>Önizleme yükleniyor...</p>;

    const mimeType = file.type;

    if (mimeType.startsWith('image/')) {
      return <img src={file.url} alt={file.name} className="max-w-full max-h-[70vh] object-contain mx-auto" />;
    }
    if (mimeType === 'application/pdf') {
      return <iframe src={file.url} title={file.name} className="w-full h-[75vh]" />;
    }
    if (mimeType.startsWith('audio/')) {
      return <audio controls src={file.url} className="w-full">Tarayıcınız ses öğesini desteklemiyor.</audio>;
    }
    if (mimeType.startsWith('video/')) {
      return <video controls src={file.url} className="max-w-full max-h-[70vh]">Tarayıcınız video öğesini desteklemiyor.</video>;
    }
    if (mimeType.startsWith('text/')) {
      return <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded-md text-sm max-h-[70vh] overflow-auto">{textContent}</pre>;
    }

    return (
      <div className="text-center p-8">
        <p>Bu dosya türü için önizleme mevcut değil ({mimeType}).</p>
        <button onClick={handleDownload} className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg shadow-sm hover:bg-sky-700 transition-colors">
          Dosyayı İndir
        </button>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Önizleme: ${file.name}`} className="max-w-4xl">
      <div className="min-h-[50vh] flex items-center justify-center">
        {renderPreview()}
      </div>
        <footer className="flex justify-end gap-4 pt-6 mt-4 border-t border-gray-200">
            <button type="button" onClick={handleDownload} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
            İndir
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg shadow-sm hover:bg-sky-700 transition-colors">
            Kapat
            </button>
        </footer>
    </Modal>
  );
};

export default FilePreviewModal;