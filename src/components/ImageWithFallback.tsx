import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ImageWithFallback({
  src,
  alt,
  className,
  fallbackClassName,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', fallbackClassName ?? className)}>
        <ImageOff className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return <img src={src} alt={alt} onError={() => setError(true)} className={className} />;
}
