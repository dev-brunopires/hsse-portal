import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoadingFallbackProps {
  message?: string;
  /** Delay (ms) before showing UI to avoid flicker on cached chunks */
  delay?: number;
}

/**
 * Lightweight Suspense fallback.
 * - Renders nothing for `delay` ms (default 200ms) so cached pages don't flash
 * - After delay, shows a minimal centered spinner instead of a full skeleton
 *   to avoid the heavy "skeleton -> empty -> data" double-flash.
 */
export function PageLoadingFallback({ message, delay = 200 }: PageLoadingFallbackProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return null;

  return (
    <div className="flex items-center justify-center py-16 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {message && <span className="text-sm">{message}</span>}
      </div>
    </div>
  );
}
