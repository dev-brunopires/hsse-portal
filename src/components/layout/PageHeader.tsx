import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  extra?: ReactNode;
}


export function PageHeader({ icon: Icon, title, subtitle, description, actions, extra }: PageHeaderProps) {
  const desc = subtitle || description;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl hidden sm:block">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">{desc}</p>
          {extra}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
