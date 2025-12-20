import { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const getCroppedImg = useCallback(async (): Promise<Blob> => {
    const image = imgRef.current;
    if (!image || !completedCrop) {
      throw new Error('No crop data');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const outputSize = 256;
    canvas.width = outputSize;
    canvas.height = outputSize;

    ctx.imageSmoothingQuality = 'high';

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    // Save context state
    ctx.save();

    // Move to center of canvas
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-outputSize / 2, -outputSize / 2);

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputSize,
      outputSize,
    );

    // Restore context state
    ctx.restore();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.95,
      );
    });
  }, [completedCrop, scale, rotate]);

  const handleConfirm = async () => {
    if (!completedCrop) return;
    
    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg();
      onCropComplete(croppedBlob);
      onOpenChange(false);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setScale(1);
    setRotate(0);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, 1));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recortar Foto de Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center bg-muted/50 rounded-lg p-4 overflow-hidden">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
              className="max-h-[300px]"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Imagem para recortar"
                style={{
                  transform: `scale(${scale}) rotate(${rotate}deg)`,
                  maxHeight: '300px',
                }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Zoom */}
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[scale]}
                onValueChange={(values) => setScale(values[0])}
                min={0.5}
                max={2}
                step={0.1}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Rotate */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotate((r) => r - 90)}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                -90°
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotate((r) => r + 90)}
              >
                +90°
                <RotateCcw className="h-4 w-4 ml-1 scale-x-[-1]" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Resetar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing || !completedCrop}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Confirmar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
