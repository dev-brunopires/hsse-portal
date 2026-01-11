import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Download, 
  Image as ImageIcon, 
  ZoomIn,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Photo {
  id: string;
  file_name: string;
  url?: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  title?: string;
  className?: string;
  gridCols?: 2 | 3 | 4;
  thumbnailHeight?: string;
}

export function PhotoGallery({
  photos,
  title,
  className,
  gridCols = 3,
  thumbnailHeight = 'h-24',
}: PhotoGalleryProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  }[gridCols];

  const handleDownload = async (photo: Photo, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!photo.url) return;

    setDownloading(photo.id);
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.file_name || `photo_${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading photo:', error);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    for (const photo of photos.filter(p => p.url)) {
      await handleDownload(photo);
      // Small delay between downloads to prevent browser blocking
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const handlePrevious = () => {
    if (selectedIndex === null) return;
    setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : photos.length - 1);
  };

  const handleNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex(selectedIndex < photos.length - 1 ? selectedIndex + 1 : 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') setSelectedIndex(null);
  };

  if (photos.length === 0) {
    return null;
  }

  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with title and download all button */}
      <div className="flex items-center justify-between">
        {title && (
          <h3 className="font-semibold flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            {title}
            <Badge variant="secondary" className="ml-1">
              {photos.length}
            </Badge>
          </h3>
        )}
        {photos.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleDownloadAll}
          >
            <Download className="h-4 w-4" />
            {t('common.downloadAll')}
          </Button>
        )}
      </div>

      {/* Photo grid */}
      <div className={cn('grid gap-3', gridColsClass)}>
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="relative group cursor-pointer rounded-lg overflow-hidden border border-border bg-muted/30"
            onClick={() => setSelectedIndex(index)}
          >
            {photo.url ? (
              <img
                src={photo.url}
                alt={photo.file_name}
                className={cn('w-full object-cover transition-transform group-hover:scale-105', thumbnailHeight)}
              />
            ) : (
              <div className={cn('w-full flex items-center justify-center bg-muted', thumbnailHeight)}>
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            
            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(index);
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => handleDownload(photo, e)}
                disabled={downloading === photo.id || !photo.url}
              >
                {downloading === photo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent 
          className="max-w-4xl h-[90vh] p-0 overflow-hidden flex flex-col"
          onKeyDown={handleKeyDown}
        >
          <DialogHeader className="p-4 pb-2 border-b border-border shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="truncate text-sm font-medium">
                {selectedPhoto?.file_name || t('common.photo')}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {selectedIndex !== null ? selectedIndex + 1 : 0} / {photos.length}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => selectedPhoto && handleDownload(selectedPhoto)}
                  disabled={downloading === selectedPhoto?.id || !selectedPhoto?.url}
                >
                  {downloading === selectedPhoto?.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {t('common.download')}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 relative flex items-center justify-center bg-black/95 min-h-0">
            {selectedPhoto?.url ? (
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.file_name}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-16 w-16" />
                <span>{t('common.imageNotAvailable')}</span>
              </div>
            )}

            {/* Navigation buttons */}
            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="p-2 border-t border-border bg-background shrink-0 overflow-x-auto">
              <div className="flex gap-2 justify-center">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedIndex(index)}
                    className={cn(
                      'h-12 w-16 rounded overflow-hidden border-2 transition-all shrink-0',
                      selectedIndex === index 
                        ? 'border-primary ring-2 ring-primary/30' 
                        : 'border-transparent hover:border-muted-foreground/30'
                    )}
                  >
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={photo.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
