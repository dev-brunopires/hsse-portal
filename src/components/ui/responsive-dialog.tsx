import * as React from 'react';
import { useIsTabletOrMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  titleIcon?: React.ReactNode;
  className?: string;
  drawerClassName?: string;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  titleIcon,
  className,
  drawerClassName,
}: ResponsiveDialogProps) {
  // Use tablet breakpoint for drawer pattern on both mobile and tablet
  const isTabletOrMobile = useIsTabletOrMobile();

  if (isTabletOrMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn('max-h-[90vh]', drawerClassName)}>
          {(title || description) && (
            <DrawerHeader className="text-left pb-2">
              {title && (
                <DrawerTitle className="flex items-center gap-2">
                  {titleIcon}
                  {title}
                </DrawerTitle>
              )}
              {description && (
                <DrawerDescription>{description}</DrawerDescription>
              )}
            </DrawerHeader>
          )}
          <div className="overflow-y-auto px-4 pb-6 flex-1">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', className)}>
        {(title || description) && (
          <DialogHeader>
            {title && (
              <DialogTitle className="flex items-center gap-2">
                {titleIcon}
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

// Compound components for more complex layouts
interface ResponsiveDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialogBody({ children, className }: ResponsiveDialogContentProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {children}
    </div>
  );
}

export function ResponsiveDialogFooter({ children, className }: ResponsiveDialogContentProps) {
  return (
    <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4', className)}>
      {children}
    </div>
  );
}
