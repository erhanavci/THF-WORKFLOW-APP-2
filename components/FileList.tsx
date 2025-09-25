import React, { useCallback, useState, useEffect } from 'react';
import { Attachment } from '../types';
import { formatFileSize } from '../utils/helpers';
import FilePreviewModal from './FilePreviewModal';
import { useToast } from '../hooks/useToast';

const FileIcon: React.FC = () => (
    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const VideoIcon: React.FC = () => (
    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);


interface ThumbnailProps {
    file?: File;
    attachment?: Attachment;
    onClick: () => void;
}

const Thumbnail: React.FC<ThumbnailProps> = ({ file, attachment, onClick }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const mimeType = file?.type || attachment?.mimeType || '';
    const isVideo = mimeType.startsWith('video/');

    useEffect(() => {
        let objectUrl: string | null = null;

        if (file) {
            objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
        } else if (attachment) {
            // Directly use the storage URL
            setPreviewUrl(attachment.blobKey);
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [file, attachment]);

    return (
        <button type="button" onClick={onClick} className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden group relative">
            {previewUrl ? (
                isVideo ? (
                    <video src={previewUrl} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" muted playsInline />
                ) : (
                    <img src={previewUrl} alt={file?.name || attachment?.fileName} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                )
            ) : (
                isVideo ? <VideoIcon /> : <FileIcon />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center text-white text-xs p-1">
                Önizle
            </div>
        </button>
    );
};


interface FileListProps {
  currentAttachments: Attachment[];
  newAttachments: {file: File, id: string}[];
  onNewAttachmentsChange: (files: {file: File, id: string}[]) => void;
  onCurrentAttachmentsChange: (attachments: Attachment[]) => void;
  // FIX: Changed type to allow functional updates for state.
  onAttachmentsToRemoveChange: React.Dispatch<React.SetStateAction<Attachment[]>>;
}

const FileList: React.FC<FileListProps> = ({ currentAttachments, newAttachments, onNewAttachmentsChange, onCurrentAttachmentsChange, onAttachmentsToRemoveChange }) => {
  const { showToast } = useToast();
  const [previewFile, setPreviewFile] = useState<{ name: string; type: string; url: string; } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).map(file => ({file, id: crypto.randomUUID()}));
      onNewAttachmentsChange([...newAttachments, ...files]);
    }
  };

  const removeNewAttachment = (index: number) => {
    onNewAttachmentsChange(newAttachments.filter((_, i) => i !== index));
  };
  
  const removeCurrentAttachment = (attachment: Attachment) => {
    onCurrentAttachmentsChange(currentAttachments.filter(a => a.id !== attachment.id));
    onAttachmentsToRemoveChange(prev => [...prev, attachment]);
  };

  const handleDownload = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank'; // Open in new tab to download
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const handlePreviewCurrent = (attachment: Attachment) => {
      setPreviewFile({ name: attachment.fileName, type: attachment.mimeType, url: attachment.blobKey });
  };

  const handlePreviewNew = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewFile({ name: file.name, type: file.type, url: url });
  };


  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">Ekler</label>
      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
        <div className="space-y-1 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex text-sm text-gray-600">
            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
              <span>Dosya yükle</span>
              <input id="file-upload" name="file-upload" type="file" multiple className="sr-only" onChange={handleFileChange} />
            </label>
            <p className="pl-1">veya sürükleyip bırak</p>
          </div>
        </div>
      </div>
      {(currentAttachments.length > 0 || newAttachments.length > 0) && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {currentAttachments.map(att => (
            <div key={att.id} className="p-2 bg-white rounded-lg border border-gray-200">
                {(att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/')) ? (
                    <Thumbnail attachment={att} onClick={() => handlePreviewCurrent(att)} />
                ) : (
                    <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileIcon />
                    </div>
                )}
              <div className="text-xs mt-2">
                <p className="truncate font-medium" title={att.fileName}>{att.fileName}</p>
                <p className="text-gray-500">{formatFileSize(att.sizeBytes)}</p>
              </div>
              <div className="mt-1 flex justify-end gap-2">
                <button type="button" onClick={() => handleDownload(att.blobKey, att.fileName)} className="text-blue-500 hover:text-blue-700 text-xs font-semibold">İndir</button>
                <button type="button" onClick={() => removeCurrentAttachment(att)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Kaldır</button>
              </div>
            </div>
          ))}
          {newAttachments.map((att, index) => (
             <div key={att.id} className="p-2 bg-blue-50 rounded-lg">
                {(att.file.type.startsWith('image/') || att.file.type.startsWith('video/')) ? (
                    <Thumbnail file={att.file} onClick={() => handlePreviewNew(att.file)} />
                ) : (
                    <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileIcon />
                    </div>
                )}
               <div className="text-xs mt-2">
                    <p className="truncate font-medium" title={att.file.name}>{att.file.name}</p>
                    <p className="text-gray-500">{formatFileSize(att.file.size)}</p>
                </div>
                <div className="mt-1 flex justify-end">
                    <button type="button" onClick={() => removeNewAttachment(index)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Kaldır</button>
                </div>
            </div>
          ))}
        </div>
      )}
       <FilePreviewModal 
            isOpen={!!previewFile} 
            onClose={() => setPreviewFile(null)}
            file={previewFile}
        />
    </div>
  );
};

export default FileList;