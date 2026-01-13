import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PendingPhoto, getPhotosByInspection } from '@/utils/offlineStorage';

interface OfflinePhotoPreviewProps {
  inspectionId: string;
  photoIds?: string[];
  className?: string;
  showCount?: boolean;
}

export function OfflinePhotoPreview({ 
  inspectionId, 
  photoIds,
  className,
  showCount = false 
}: OfflinePhotoPreviewProps) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    const loadPhotos = async () => {
      setIsLoading(true);
      try {
        const loadedPhotos = await getPhotosByInspection(inspectionId);
        // If photoIds are provided, filter by them
        if (photoIds && photoIds.length > 0) {
          setPhotos(loadedPhotos.filter(p => photoIds.includes(p.id)));
        } else {
          setPhotos(loadedPhotos);
        }
      } catch (error) {
        console.error('Error loading offline photos:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPhotos();
  }, [inspectionId, photoIds]);

  const handlePrevious = () => {
    setCurrentPhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = () => {
    setCurrentPhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const getImageSrc = (photo: PendingPhoto) => {
    return `data:${photo.mimeType};base64,${photo.base64Data}`;
  };

  if (isLoading) {
    return showCount ? null : (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Image className="h-3 w-3 animate-pulse" />
      </div>
    );
  }

  if (photos.length === 0) {
    return showCount ? null : (
      <span className="text-xs text-muted-foreground">{t('offline.noPhotos')}</span>
    );
  }

  // Count-only mode (for badges)
  if (showCount) {
    return (
      <Badge variant="secondary" className={cn("gap-1 text-xs", className)}>
        <Image className="h-3 w-3" />
        {photos.length}
      </Badge>
    );
  }

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        {/* Photo thumbnails */}
        <div className="flex -space-x-2">
          {photos.slice(0, 3).map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => {
                setCurrentPhotoIndex(index);
                setLightboxOpen(true);
              }}
              className={cn(
                "relative h-10 w-10 rounded-lg overflow-hidden border-2 border-background",
                "hover:z-10 hover:scale-110 transition-transform cursor-pointer"
              )}
            >
              <img
                src={getImageSrc(photo)}
                alt={photo.fileName}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
          {photos.length > 3 && (
            <button
              onClick={() => {
                setCurrentPhotoIndex(3);
                setLightboxOpen(true);
              }}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-lg",
                "border-2 border-background bg-muted text-muted-foreground text-xs font-medium",
                "hover:bg-accent transition-colors cursor-pointer"
              )}
            >
              +{photos.length - 3}
            </button>
          )}
        </div>
        
        {/* Expand button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            setCurrentPhotoIndex(0);
            setLightboxOpen(true);
          }}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                {t('offline.pendingPhotos')} ({currentPhotoIndex + 1}/{photos.length})
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">{t('offline.pendingPhotos')}</DialogDescription>
          </DialogHeader>

          <div className="relative flex-1 min-h-[300px] max-h-[60vh] flex items-center justify-center bg-muted/50 p-4">
            {photos[currentPhotoIndex] && (
              <img
                src={getImageSrc(photos[currentPhotoIndex])}
                alt={photos[currentPhotoIndex].fileName}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            )}

            {photos.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          <ScrollArea className="p-4 pt-0">
            <div className="flex gap-2 justify-center">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={cn(
                    "h-16 w-16 rounded-lg overflow-hidden border-2 transition-all",
                    index === currentPhotoIndex 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                >
                  <img
                    src={getImageSrc(photo)}
                    alt={photo.fileName}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
