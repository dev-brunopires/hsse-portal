import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import i18n from '@/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Detect chunk load failures
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('ChunkLoadError');

    return { hasError: true, isChunkError };
  }

  handleReload = () => {
    // Clear caches and reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const t = i18n.t.bind(i18n);
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center max-w-md">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {this.state.isChunkError
                ? t('errorBoundary.updateAvailable')
                : t('errorBoundary.somethingWentWrong')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {this.state.isChunkError
                ? t('errorBoundary.newVersionMessage')
                : t('errorBoundary.unexpectedErrorMessage')}
            </p>
            <Button onClick={this.handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('errorBoundary.reload')}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
