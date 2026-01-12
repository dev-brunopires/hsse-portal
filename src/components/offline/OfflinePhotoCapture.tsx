import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  X, 
  Image as ImageIcon, 
  Trash2, 
  Loader2,
  Upload,
  ZoomIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  processAndStorePhoto, 
  removePhoto, 
  type PendingPhoto 
} from '@/utils/offlineStorage';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface OfflinePhotoCaptureProps {
  inspectionId: string;
  photos: PendingPhoto[];
  onPhotosChange: (photos: PendingPhoto[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export function OfflinePhotoCapture({
  inspectionId,
  photos,
  onPhotosChange,
  maxPhotos = 5,
  disabled = false,
}: OfflinePhotoCaptureProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PendingPhoto | null>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      toast.error(t('offline.maxPhotosReached', { count: maxPhotos }));
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    setIsProcessing(true);

    try {
      const newPhotos: PendingPhoto[] = [];
      
      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) {
          toast.error(t('offline.invalidFileType'));
          continue;
        }

        // Process and store photo with compression
        const pendingPhoto = await processAndStorePhoto(file, inspectionId);
        newPhotos.push(pendingPhoto);
      }

      if (newPhotos.length > 0) {
        onPhotosChange([...photos, ...newPhotos]);
        toast.success(t('offline.photosAdded', { count: newPhotos.length }));
      }
    } catch (error) {
      console.error('Error processing photos:', error);
      toast.error(t('offline.photoProcessError'));
    } finally {
      setIsProcessing(false);
      // Reset inputs
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }, [photos, inspectionId, maxPhotos, onPhotosChange, t]);

  const handleRemovePhoto = useCallback(async (photoId: string) => {
    try {
      await removePhoto(photoId);
      onPhotosChange(photos.filter(p => p.id !== photoId));
      toast.success(t('offline.photoRemoved'));
    } catch (error) {
      console.error('Error removing photo:', error);
      toast.error(t('offline.photoRemoveError'));
    }
  }, [photos, onPhotosChange, t]);

  const getPhotoDataUrl = (photo: PendingPhoto) => {
    return `data:${photo.mimeType};base64,${photo.base64Data}`;
  };

  const canAddMore = photos.length < maxPhotos && !disabled;

  return (
    <div className="space-y-4">
      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative aspect-square rounded-lg overflow-hidden border bg-muted group"
          >
            <img
              src={getPhotoDataUrl(photo)}
              alt={photo.fileName}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setPreviewPhoto(photo)}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={() => setPreviewPhoto(photo)}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-status-danger/50"
                onClick={() => handleRemovePhoto(photo.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Badge 
              variant="secondary" 
              className="absolute bottom-1 right-1 text-[10px] px-1 py-0 bg-black/60 text-white border-0"
            >
              {Math.round(photo.base64Data.length * 0.75 / 1024)}KB
            </Badge>
          </div>
        ))}

        {/* Add photo buttons */}
        {canAddMore && (
          <>
            {/* Camera button */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isProcessing}
              className={cn(
                "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
                "hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary",
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Camera className="h-6 w-6" />
                  <span className="text-[10px]">{t('offline.camera')}</span>
                </>
              )}
            </button>

            {/* Gallery button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className={cn(
                "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
                "hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary",
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Upload className="h-6 w-6" />
                  <span className="text-[10px]">{t('offline.gallery')}</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Counter */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <ImageIcon className="h-4 w-4" />
          {t('offline.photosCount', { current: photos.length, max: maxPhotos })}
        </span>
        {photos.length > 0 && (
          <span className="text-xs">
            ~{Math.round(photos.reduce((acc, p) => acc + p.base64Data.length * 0.75, 0) / 1024)}KB {t('offline.total')}
          </span>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={isProcessing || disabled}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={isProcessing || disabled}
      />

      {/* Photo preview dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>{previewPhoto?.fileName || t('offline.photoPreview')}</DialogTitle>
          </VisuallyHidden>
          {previewPhoto && (
            <div className="relative">
              <img
                src={getPhotoDataUrl(previewPhoto)}
                alt={previewPhoto.fileName}
                className="w-full h-auto max-h-[85vh] object-contain"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setPreviewPhoto(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-sm truncate">{previewPhoto.fileName}</p>
                <p className="text-white/70 text-xs">
                  {Math.round(previewPhoto.base64Data.length * 0.75 / 1024)}KB
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
