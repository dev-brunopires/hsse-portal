import { Loader2 } from 'lucide-react';
import { Skeleton } from './skeleton';

interface PageLoadingFallbackProps {
  message?: string;
}

export function PageLoadingFallback({ message }: PageLoadingFallbackProps) {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Content skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="border rounded-xl overflow-hidden">
        <div className="bg-muted/50 p-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="divide-y">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 bg-card border shadow-lg rounded-full px-4 py-2 flex items-center gap-2 z-50">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{message || 'Carregando...'}</span>
      </div>
    </div>
  );
}
