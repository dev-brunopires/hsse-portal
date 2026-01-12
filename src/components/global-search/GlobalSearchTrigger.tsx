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
          'relative h-9 w-full justify-start rounded-lg bg-muted/50 text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64',
          className
        )}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">{t('globalSearch.placeholder')}</span>
        <span className="inline-flex lg:hidden">{t('globalSearch.search')}</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
