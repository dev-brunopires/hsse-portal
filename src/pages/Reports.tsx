import { FileText, Download, Calendar, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const reportTypes = [
  {
    title: 'Relatório de Inspeção',
    description: 'Relatório detalhado de inspeções por equipamento',
    icon: FileText,
  },
  {
    title: 'Relatório por Categoria',
    description: 'Análise de equipamentos agrupados por categoria',
    icon: Filter,
  },
  {
    title: 'Relatório de Vencimentos',
    description: 'Equipamentos com certificados próximos do vencimento',
    icon: Calendar,
  },
  {
    title: 'Relatório de Não Conformidades',
    description: 'Histórico de não conformidades e ações corretivas',
    icon: FileText,
  },
];

export default function Reports() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">
            Geração de relatórios profissionais para auditoria
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report) => (
          <Card key={report.title} className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <report.icon className="h-5 w-5 text-primary" />
                {report.title}
              </CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
