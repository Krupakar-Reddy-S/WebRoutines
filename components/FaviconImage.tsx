import { useState } from 'react';

import { getFaviconUrl } from '@/lib/url';

interface FaviconImageProps {
  url: string;
  sizeClassName?: string;
}

export function FaviconImage({ url, sizeClassName = 'h-5 w-5' }: FaviconImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-hidden="true"
        className={`${sizeClassName} inline-flex items-center justify-center rounded-sm bg-muted text-[11px] leading-none`}
      >
        🌐
      </span>
    );
  }

  return (
    <img
      src={getFaviconUrl(url)}
      alt=""
      className={`${sizeClassName} rounded-sm bg-muted object-cover`}
      onError={() => setFailed(true)}
    />
  );
}
