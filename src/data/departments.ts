export interface DepartmentOption {
  value: string;
  ptBR: string;
  en: string;
}

export const departmentOptions: DepartmentOption[] = [
  { value: 'administration', ptBR: 'Administracao', en: 'Administration' },
  { value: 'cargo', ptBR: 'Carga', en: 'Cargo' },
  { value: 'commercial', ptBR: 'Comercial', en: 'Commercial' },
  { value: 'engineering', ptBR: 'Engenharia', en: 'Engineering' },
  { value: 'hse', ptBR: 'HSSE / Seguranca', en: 'HSSE / Safety' },
  { value: 'human_resources', ptBR: 'Recursos Humanos', en: 'Human Resources' },
  { value: 'information_technology', ptBR: 'Tecnologia da Informacao', en: 'Information Technology' },
  { value: 'inspection', ptBR: 'Inspecao', en: 'Inspection' },
  { value: 'maintenance', ptBR: 'Manutencao', en: 'Maintenance' },
  { value: 'marine', ptBR: 'Marinha / Nautica', en: 'Marine' },
  { value: 'medical', ptBR: 'Saude / Medico', en: 'Health / Medical' },
  { value: 'operations', ptBR: 'Operacoes', en: 'Operations' },
  { value: 'process_safety', ptBR: 'Seguranca de Processo', en: 'Process Safety' },
  { value: 'production', ptBR: 'Producao', en: 'Production' },
  { value: 'projects', ptBR: 'Projetos', en: 'Projects' },
  { value: 'quality', ptBR: 'Qualidade', en: 'Quality' },
  { value: 'subsea', ptBR: 'Subsea', en: 'Subsea' },
  { value: 'supply_chain', ptBR: 'Suprimentos / Logistica', en: 'Supply Chain / Logistics' },
];

export function getDepartmentLabel(value: string | null | undefined, language = 'pt-BR') {
  if (!value) return '';
  const option = departmentOptions.find((item) => item.value === value);
  if (!option) return value;
  return language === 'en' ? option.en : option.ptBR;
}
