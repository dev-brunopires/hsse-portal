import * as XLSX from 'xlsx';

export interface ImportedEquipment {
  internal_code: string;
  name: string;
  category_name?: string; // For matching by name
  ship_name?: string; // For matching by name
  type: string;
  manufacturer?: string;
  model?: string;
  serial_number: string;
  capacity?: string;
  unit: string;
  location: string;
  status?: string;
  manufacturing_date?: string;
  acquisition_date?: string;
  expiry_date?: string;
  certificate_expiry?: string;
  observations?: string;
}

export interface ImportResult {
  success: boolean;
  data?: ImportedEquipment[];
  errors?: string[];
}

const columnMapping: Record<string, keyof ImportedEquipment> = {
  // Internal code
  'código interno': 'internal_code',
  'codigo interno': 'internal_code',
  'código': 'internal_code',
  'codigo': 'internal_code',
  'internal code': 'internal_code',
  'code': 'internal_code',
  
  // Name
  'nome': 'name',
  'equipamento': 'name',
  'name': 'name',
  'equipment': 'name',
  
  // Category
  'categoria': 'category_name',
  'category': 'category_name',
  
  // Ship/Unit
  'navio': 'ship_name',
  'embarcação': 'ship_name',
  'embarcacao': 'ship_name',
  'ship': 'ship_name',
  'vessel': 'ship_name',
  'unidade operacional': 'ship_name',
  
  // Type
  'tipo': 'type',
  'type': 'type',
  
  // Manufacturer
  'fabricante': 'manufacturer',
  'manufacturer': 'manufacturer',
  
  // Model
  'modelo': 'model',
  'model': 'model',
  
  // Serial number
  'número de série': 'serial_number',
  'numero de serie': 'serial_number',
  'nº série': 'serial_number',
  'n série': 'serial_number',
  'série': 'serial_number',
  'serie': 'serial_number',
  'serial number': 'serial_number',
  'serial': 'serial_number',
  
  // Capacity
  'capacidade': 'capacity',
  'capacity': 'capacity',
  
  // Unit/Department
  'unidade': 'unit',
  'departamento': 'unit',
  'unit': 'unit',
  'department': 'unit',
  
  // Location
  'localização': 'location',
  'localizacao': 'location',
  'local': 'location',
  'location': 'location',
  
  // Status
  'status': 'status',
  'situação': 'status',
  'situacao': 'status',
  
  // Manufacturing date
  'data fabricação': 'manufacturing_date',
  'data fabricacao': 'manufacturing_date',
  'fabricação': 'manufacturing_date',
  'manufacturing date': 'manufacturing_date',
  
  // Acquisition date
  'data aquisição': 'acquisition_date',
  'data aquisicao': 'acquisition_date',
  'aquisição': 'acquisition_date',
  'acquisition date': 'acquisition_date',
  
  // Expiry date
  'validade': 'expiry_date',
  'data validade': 'expiry_date',
  'expiry date': 'expiry_date',
  'expiry': 'expiry_date',
  
  // Certificate expiry
  'validade certificado': 'certificate_expiry',
  'val. certificado': 'certificate_expiry',
  'certificate expiry': 'certificate_expiry',
  
  // Observations
  'observações': 'observations',
  'observacoes': 'observations',
  'obs': 'observations',
  'observations': 'observations',
  'notes': 'observations',
};

const statusMapping: Record<string, string> = {
  'ativo': 'active',
  'active': 'active',
  'manutenção': 'maintenance',
  'manutencao': 'maintenance',
  'maintenance': 'maintenance',
  'reprovado': 'rejected',
  'rejected': 'rejected',
  'vencido': 'expired',
  'expired': 'expired',
  'inativo': 'inactive',
  'inactive': 'inactive',
};

function parseDate(value: any): string | undefined {
  if (!value) return undefined;
  
  if (typeof value === 'number') {
    // Excel date serial number
    const date = XLSX.SSF.parse_date_code(value);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  
  if (typeof value === 'string') {
    // Try DD/MM/YYYY format
    const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
    
    // Try YYYY-MM-DD format
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return value;
    }
  }
  
  return undefined;
}

function parseStatus(value: any): string | undefined {
  if (!value) return undefined;
  const normalized = String(value).toLowerCase().trim();
  return statusMapping[normalized] || undefined;
}

export function parseCSV(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          resolve({ success: false, errors: ['Arquivo vazio ou sem dados'] });
          return;
        }
        
        const headers = jsonData[0].map((h: string) => String(h).toLowerCase().trim());
        const rows = jsonData.slice(1);
        const errors: string[] = [];
        const imported: ImportedEquipment[] = [];
        
        rows.forEach((row, rowIndex) => {
          if (row.every(cell => !cell)) return; // Skip empty rows
          
          const item: Partial<ImportedEquipment> = {};
          
          headers.forEach((header, colIndex) => {
            const mappedKey = columnMapping[header];
            if (mappedKey && row[colIndex] !== undefined && row[colIndex] !== null) {
              const value = row[colIndex];
              
              if (mappedKey.includes('date') || mappedKey === 'certificate_expiry') {
                item[mappedKey] = parseDate(value) || '';
              } else if (mappedKey === 'status') {
                item[mappedKey] = parseStatus(value) || 'active';
              } else {
                item[mappedKey] = String(value).trim();
              }
            }
          });
          
          // Validate required fields - only truly required ones
          const requiredFields: (keyof ImportedEquipment)[] = [
            'internal_code', 'name', 'type', 'serial_number', 'unit', 'location'
          ];
          
          const missingFields = requiredFields.filter(f => !item[f]);
          
          if (missingFields.length > 0) {
            errors.push(`Linha ${rowIndex + 2}: Campos obrigatórios faltando: ${missingFields.join(', ')}`);
          } else {
            imported.push(item as ImportedEquipment);
          }
        });
        
        if (imported.length === 0 && errors.length > 0) {
          resolve({ success: false, errors });
        } else {
          resolve({ success: true, data: imported, errors: errors.length > 0 ? errors : undefined });
        }
      } catch (error) {
        resolve({ success: false, errors: ['Erro ao processar arquivo: ' + (error as Error).message] });
      }
    };
    
    reader.onerror = () => {
      resolve({ success: false, errors: ['Erro ao ler arquivo'] });
    };
    
    reader.readAsBinaryString(file);
  });
}

export function generateTemplate(): void {
  const templateData = [{
    'Código Interno': 'EXT-001',
    'Nome': 'Extintor ABC 6kg',
    'Categoria': 'Extintores',
    'Navio': 'FPSO Cidade de Santos',
    'Tipo': 'Extintor de Incêndio',
    'Fabricante': 'Kidde',
    'Modelo': 'K-10',
    'Nº Série': 'SN123456',
    'Capacidade': '6kg',
    'Unidade': 'Operações',
    'Localização': 'Convés Principal',
    'Status': 'Ativo',
    'Data Fabricação': '01/01/2023',
    'Data Aquisição': '15/01/2023',
    'Validade': '01/01/2028',
    'Validade Certificado': '01/01/2025',
    'Observações': 'Equipamento novo',
  }];

  const ws = XLSX.utils.json_to_sheet(templateData);
  
  // Set column widths for better visibility
  ws['!cols'] = [
    { wch: 15 }, // Código Interno
    { wch: 25 }, // Nome
    { wch: 15 }, // Categoria
    { wch: 25 }, // Navio
    { wch: 20 }, // Tipo
    { wch: 15 }, // Fabricante
    { wch: 12 }, // Modelo
    { wch: 15 }, // Nº Série
    { wch: 12 }, // Capacidade
    { wch: 12 }, // Unidade
    { wch: 20 }, // Localização
    { wch: 10 }, // Status
    { wch: 15 }, // Data Fabricação
    { wch: 15 }, // Data Aquisição
    { wch: 12 }, // Validade
    { wch: 18 }, // Validade Certificado
    { wch: 25 }, // Observações
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  
  XLSX.writeFile(wb, 'template_importacao_equipamentos.xlsx');
}
