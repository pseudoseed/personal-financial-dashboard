import { useState } from 'react';
import { BanknotesIcon } from '@heroicons/react/24/outline';

interface InstitutionLogoProps {
  src?: string;
  alt?: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export function InstitutionLogo({ src, alt = 'Bank logo', className = '', fallbackIcon }: InstitutionLogoProps) {
  const [imgError, setImgError] = useState(false);

  if (!src || imgError) {
    return fallbackIcon || <BanknotesIcon className={className || 'h-5 w-5 text-gray-400'} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setImgError(true)}
    />
  );
} 