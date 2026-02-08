import { useMemo, useState } from 'react';

import { getFaviconUrl } from '@/lib/url';

interface FaviconImageProps {
  url: string;
  sizeClassName?: string;
}

export function FaviconImage({ url, sizeClassName = 'h-5 w-5' }: FaviconImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const faviconUrl = useMemo(() => getFaviconUrl(url), [url]);
  const failed = !faviconUrl || failedSrc === faviconUrl;

  if (failed || !faviconUrl) {
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
      src={faviconUrl}
      alt=""
      className={`${sizeClassName} rounded-sm bg-muted object-cover`}
      onError={() => setFailedSrc(faviconUrl)}
    />
  );
}
