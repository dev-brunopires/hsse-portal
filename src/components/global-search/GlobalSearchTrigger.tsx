import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { GlobalSearchDialog } from './GlobalSearchDialog';
import { cn } from '@/lib/utils';

interface GlobalSearchTriggerProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export function GlobalSearchTrigger({ className, variant = 'default' }: GlobalSearchTriggerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (variant === 'compact') {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className={cn('h-9 w-9', className)}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">{t('globalSearch.open')}</span>
        </Button>
        <GlobalSearchDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn(
          'relative h-9 justify-start rounded-lg bg-muted/50 text-sm text-muted-foreground',
          'w-[200px] lg:w-[280px]',
          className
        )}
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="ml-2 truncate flex-1 text-left">
          {t('globalSearch.placeholder')}
        </span>
        <kbd className="ml-2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex flex-shrink-0">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
