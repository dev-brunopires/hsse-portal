import { EquipmentTable } from '@/components/equipment/EquipmentTable';
import { mockEquipment } from '@/data/mockData';

export default function EquipmentList() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipamentos</h1>
          <p className="text-muted-foreground">
            Gerenciamento completo de equipamentos de segurança
          </p>
        </div>
      </div>

      {/* Equipment Table */}
      <EquipmentTable equipment={mockEquipment} />
    </div>
  );
}
