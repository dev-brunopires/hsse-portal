import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';

interface HealthCheckProgressProps {
  progress: number;
  completedChecks: number;
  totalChecks: number;
  isRunning: boolean;
}

export function HealthCheckProgress({ 
  progress, 
  completedChecks, 
  totalChecks, 
  isRunning 
}: HealthCheckProgressProps) {
  const { t } = useTranslation();

  if (!isRunning && progress === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {isRunning ? t('healthCheck.running') : t('healthCheck.completed')}
        </span>
        <span className="font-medium">
          {completedChecks}/{totalChecks} ({Math.round(progress)}%)
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
