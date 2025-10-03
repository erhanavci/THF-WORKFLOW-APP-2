import React from 'react';
import { Member } from '../types';

interface AvatarProps {
  member: Member;
  size?: 'sm' | 'md' | 'lg';
  responsible?: boolean;
  srcOverride?: string | null;
}

const Avatar: React.FC<AvatarProps> = ({ member, size = 'md', responsible = false, srcOverride }) => {
  const [hasError, setHasError] = React.useState(false);
  const imageUrl = srcOverride || member.avatarUrl;

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const fallbackAvatar = (
    <div className={`${sizeClasses[size]} rounded-full bg-gray-300 flex items-center justify-center text-white font-bold`}>
        {member.name.charAt(0).toUpperCase()}
    </div>
  );
  
  // Render fallback if there is no image URL or if the image failed to load
  if (!imageUrl || hasError) {
      return (
        <div className="relative group">
          {fallbackAvatar}
          <div className="absolute z-10 bottom-full mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none left-1/2 -translate-x-1/2">
            {member.name}
          </div>
        </div>
      );
  }

  return (
    <div className="relative group">
        <img
          className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-white ${responsible ? 'ring-sky-500' : ''}`}
          src={imageUrl}
          alt={member.name}
          onError={() => setHasError(true)}
        />
      <div className="absolute z-10 bottom-full mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none left-1/2 -translate-x-1/2">
        {member.name}
        {member.email && <span className="text-gray-400 block text-xs">{member.email}</span>}
        {member.role && <span className="text-gray-400 block">{member.role}</span>}
      </div>
    </div>
  );
};

export default Avatar;