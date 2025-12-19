import { FolderOpen, Plus, Settings, Flame, Wind, Shield, Waves, Gauge, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { mockCategories } from '@/data/mockData';

const iconMap: Record<string, React.ElementType> = {
  flame: Flame,
  wind: Wind,
  shield: Shield,
  waves: Waves,
  gauge: Gauge,
  'arrow-up': ArrowUp,
};

const frequencyLabels: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  custom: 'Personalizada',
};

export default function Categories() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-muted-foreground">
            Gerenciamento de tipos de equipamentos e regras de inspeção
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockCategories.map((category) => {
          const IconComponent = iconMap[category.icon] || FolderOpen;
          
          return (
            <Card key={category.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="mt-4">{category.name}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frequência de Inspeção:</span>
                    <span className="font-medium">{frequencyLabels[category.inspectionFrequency]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Campos Customizados:</span>
                    <span className="font-medium">{category.customFields.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
