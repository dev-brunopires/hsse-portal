import { useRef, useEffect, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eraser, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureData: string) => void;
  onCancel?: () => void;
  initialSignature?: string;
}

export function SignaturePad({ onSave, onCancel, initialSignature }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);

      signaturePadRef.current = new SignaturePadLib(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      });

      signaturePadRef.current.addEventListener('endStroke', () => {
        setIsEmpty(signaturePadRef.current?.isEmpty() ?? true);
      });

      if (initialSignature) {
        signaturePadRef.current.fromDataURL(initialSignature);
        setIsEmpty(false);
      }
    }

    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
    };
  }, [initialSignature]);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const dataUrl = signaturePadRef.current.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PenTool className="h-4 w-4" />
          Assinatura do Inspetor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-32 touch-none"
            style={{ touchAction: 'none' }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Desenhe sua assinatura no campo acima
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="flex-1"
          >
            <Eraser className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isEmpty}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirmar Assinatura
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
