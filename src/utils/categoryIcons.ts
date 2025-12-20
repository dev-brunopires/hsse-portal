import { 
  FolderOpen, Flame, Wind, Shield, Waves, Gauge, ArrowUp, Package, HardHat, LifeBuoy, Anchor,
  FireExtinguisher, Siren, AlertTriangle, Zap, Droplets, Thermometer, Activity, Radio, Bell,
  Construction, Wrench, Settings, Cog, Truck, Building, Factory, Warehouse, Cylinder, CircleDot,
  ShieldCheck, ShieldAlert, Eye, Camera, Lock, Key, Plug, Power, BatteryCharging,
  TriangleAlert, OctagonAlert, CircleAlert, Megaphone, Volume2, Flashlight, Lightbulb,
  type LucideIcon
} from 'lucide-react';

export const categoryIconMap: Record<string, LucideIcon> = {
  // Combate a incêndio
  'fire-extinguisher': FireExtinguisher,
  'flame': Flame,
  'droplets': Droplets,
  'waves': Waves,
  'siren': Siren,
  'megaphone': Megaphone,
  
  // Segurança e alertas
  'shield': Shield,
  'shield-check': ShieldCheck,
  'shield-alert': ShieldAlert,
  'alert-triangle': AlertTriangle,
  'triangle-alert': TriangleAlert,
  'octagon-alert': OctagonAlert,
  'circle-alert': CircleAlert,
  
  // Equipamentos industriais
  'cylinder': Cylinder,
  'gauge': Gauge,
  'thermometer': Thermometer,
  'activity': Activity,
  
  // EPIs e proteção
  'hard-hat': HardHat,
  'eye': Eye,
  'life-buoy': LifeBuoy,
  
  // Elétrica e energia
  'zap': Zap,
  'plug': Plug,
  'power': Power,
  'battery-charging': BatteryCharging,
  'lightbulb': Lightbulb,
  'flashlight': Flashlight,
  
  // Ferramentas e manutenção
  'wrench': Wrench,
  'settings': Settings,
  'cog': Cog,
  'construction': Construction,
  
  // Comunicação e monitoramento
  'radio': Radio,
  'bell': Bell,
  'volume-2': Volume2,
  'camera': Camera,
  
  // Estruturas e locais
  'building': Building,
  'factory': Factory,
  'warehouse': Warehouse,
  'truck': Truck,
  
  // Outros
  'wind': Wind,
  'arrow-up': ArrowUp,
  'package': Package,
  'anchor': Anchor,
  'lock': Lock,
  'key': Key,
  'circle-dot': CircleDot,
  'folder-open': FolderOpen,
};

export const defaultCategoryIcon = FolderOpen;

export function getCategoryIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return defaultCategoryIcon;
  return categoryIconMap[iconName] || defaultCategoryIcon;
}

export const categoryIconOptions = [
  // Combate a incêndio
  { value: 'fire-extinguisher', label: 'Extintor', icon: FireExtinguisher },
  { value: 'flame', label: 'Fogo', icon: Flame },
  { value: 'droplets', label: 'Mangueira/Água', icon: Droplets },
  { value: 'waves', label: 'Hidrante', icon: Waves },
  { value: 'siren', label: 'Alarme', icon: Siren },
  { value: 'megaphone', label: 'Sirene', icon: Megaphone },
  
  // Segurança e alertas
  { value: 'shield', label: 'Escudo', icon: Shield },
  { value: 'shield-check', label: 'Proteção', icon: ShieldCheck },
  { value: 'shield-alert', label: 'Alerta Segurança', icon: ShieldAlert },
  { value: 'alert-triangle', label: 'Atenção', icon: AlertTriangle },
  { value: 'triangle-alert', label: 'Perigo', icon: TriangleAlert },
  { value: 'octagon-alert', label: 'Parada', icon: OctagonAlert },
  { value: 'circle-alert', label: 'Aviso', icon: CircleAlert },
  
  // Equipamentos industriais
  { value: 'cylinder', label: 'Cilindro', icon: Cylinder },
  { value: 'gauge', label: 'Manômetro', icon: Gauge },
  { value: 'thermometer', label: 'Termômetro', icon: Thermometer },
  { value: 'activity', label: 'Monitor', icon: Activity },
  
  // EPIs e proteção
  { value: 'hard-hat', label: 'Capacete', icon: HardHat },
  { value: 'eye', label: 'Óculos/Visão', icon: Eye },
  { value: 'life-buoy', label: 'Boia', icon: LifeBuoy },
  
  // Elétrica e energia
  { value: 'zap', label: 'Elétrico', icon: Zap },
  { value: 'plug', label: 'Tomada', icon: Plug },
  { value: 'power', label: 'Energia', icon: Power },
  { value: 'battery-charging', label: 'Bateria', icon: BatteryCharging },
  { value: 'lightbulb', label: 'Iluminação', icon: Lightbulb },
  { value: 'flashlight', label: 'Lanterna', icon: Flashlight },
  
  // Ferramentas e manutenção
  { value: 'wrench', label: 'Ferramenta', icon: Wrench },
  { value: 'settings', label: 'Configuração', icon: Settings },
  { value: 'cog', label: 'Engrenagem', icon: Cog },
  { value: 'construction', label: 'Construção', icon: Construction },
  
  // Comunicação e monitoramento
  { value: 'radio', label: 'Rádio', icon: Radio },
  { value: 'bell', label: 'Notificação', icon: Bell },
  { value: 'volume-2', label: 'Som', icon: Volume2 },
  { value: 'camera', label: 'Câmera', icon: Camera },
  
  // Estruturas e locais
  { value: 'building', label: 'Prédio', icon: Building },
  { value: 'factory', label: 'Fábrica', icon: Factory },
  { value: 'warehouse', label: 'Armazém', icon: Warehouse },
  { value: 'truck', label: 'Veículo', icon: Truck },
  
  // Outros
  { value: 'wind', label: 'Ventilação', icon: Wind },
  { value: 'arrow-up', label: 'Altura', icon: ArrowUp },
  { value: 'package', label: 'Pacote', icon: Package },
  { value: 'anchor', label: 'Âncora', icon: Anchor },
  { value: 'lock', label: 'Cadeado', icon: Lock },
  { value: 'key', label: 'Chave', icon: Key },
  { value: 'circle-dot', label: 'Ponto', icon: CircleDot },
];
