export type AccessAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'admin';

export type AccessModuleKey =
  | 'equipment'
  | 'health'
  | 'evv'
  | 'obs_cards'
  | 'reports'
  | 'admin'
  | 'alerts'
  | 'audit'
  | 'settings';

export type AppRole = 'admin' | 'admin_master' | 'technician' | 'supervisor' | 'viewer';

export interface AccessPageDefinition {
  key: string;
  name: string;
  route: string;
  description?: string;
  actions: AccessAction[];
}

export interface AccessModuleDefinition {
  key: AccessModuleKey;
  name: string;
  description?: string;
  pages: AccessPageDefinition[];
}

export interface PermissionFlags {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
  can_admin: boolean;
}

export const ACCESS_ACTIONS: { key: AccessAction; label: string; flag: keyof PermissionFlags }[] = [
  { key: 'view', label: 'Ver', flag: 'can_view' },
  { key: 'create', label: 'Criar', flag: 'can_create' },
  { key: 'edit', label: 'Editar', flag: 'can_edit' },
  { key: 'delete', label: 'Excluir', flag: 'can_delete' },
  { key: 'approve', label: 'Aprovar', flag: 'can_approve' },
  { key: 'export', label: 'Exportar', flag: 'can_export' },
  { key: 'admin', label: 'Admin', flag: 'can_admin' },
];

export const EMPTY_PERMISSION_FLAGS: PermissionFlags = {
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  can_approve: false,
  can_export: false,
  can_admin: false,
};

export const ACCESS_MODULES: AccessModuleDefinition[] = [
  {
    key: 'equipment',
    name: 'Gestao de Equipamentos',
    pages: [
      { key: 'dashboard', name: 'Dashboard', route: '/', actions: ['view', 'export'] },
      { key: 'equipment', name: 'Equipamentos', route: '/equipment', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'inspections', name: 'Inspecoes', route: '/inspections', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
      { key: 'maintenance', name: 'Manutencao', route: '/maintenance', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
      { key: 'certificates', name: 'Certificados', route: '/certificates', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'pending', name: 'Pendencias', route: '/pending', actions: ['view', 'edit', 'approve', 'export'] },
      { key: 'categories', name: 'Categorias', route: '/categories', actions: ['view', 'create', 'edit', 'delete', 'admin'] },
      { key: 'supervisor', name: 'Supervisor', route: '/supervisor', actions: ['view', 'approve', 'export'] },
    ],
  },
  {
    key: 'health',
    name: 'Gestao de Saude',
    pages: [
      { key: 'heat_stress', name: 'Heat Stress', route: '/heat-stress', actions: ['view', 'create', 'edit', 'export'] },
      { key: 'health_check', name: 'Health Check', route: '/health-check', actions: ['view', 'create', 'edit', 'export', 'admin'] },
    ],
  },
  {
    key: 'evv',
    name: 'eV&V',
    pages: [
      { key: 'home', name: 'Inicio', route: '/evv', actions: ['view'] },
      { key: 'forms', name: 'Formularios', route: '/evv/forms', actions: ['view', 'create'] },
      { key: 'history', name: 'Historico', route: '/evv/history', actions: ['view', 'edit', 'delete', 'export'] },
      { key: 'review', name: 'Revisao', route: '/evv/review', actions: ['view', 'approve', 'export'] },
      { key: 'reports', name: 'Relatorios', route: '/evv/reports', actions: ['view', 'export', 'admin'] },
    ],
  },
  {
    key: 'obs_cards',
    name: 'OBS Cards',
    pages: [
      { key: 'dashboard', name: 'Observation Card com IA', route: '/obs-cards', actions: ['view', 'export'] },
      { key: 'safety_observation', name: 'Formulario de Observacao de Seguranca', route: '/obs-cards/safety-observation', actions: ['view', 'create', 'edit', 'export'] },
      { key: 'reports', name: 'Relatorios de Observacao de Seguranca', route: '/obs-cards/reports', actions: ['view', 'edit', 'delete', 'export'] },
      { key: 'upload', name: 'Upload', route: '/obs-cards/upload', actions: ['view', 'create', 'admin'] },
      { key: 'datasets', name: 'Datasets', route: '/obs-cards/datasets', actions: ['view', 'edit', 'delete', 'admin'] },
    ],
  },
  {
    key: 'reports',
    name: 'Relatorios',
    pages: [
      { key: 'reports', name: 'Relatorios Consolidados', route: '/reports', actions: ['view', 'export'] },
    ],
  },
  {
    key: 'alerts',
    name: 'Alertas',
    pages: [
      { key: 'alerts', name: 'Alertas', route: '/alerts', actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key: 'admin',
    name: 'Administracao',
    pages: [
      { key: 'users', name: 'Usuarios', route: '/users', actions: ['view', 'create', 'edit', 'delete', 'admin'] },
      { key: 'ships', name: 'Navios', route: '/users', actions: ['view', 'create', 'edit', 'delete', 'admin'] },
      { key: 'regions', name: 'Regioes', route: '/users', actions: ['view', 'create', 'edit', 'delete', 'admin'] },
      { key: 'platform_admin', name: 'Plataforma', route: '/platform-admin', actions: ['view', 'admin'] },
    ],
  },
  {
    key: 'audit',
    name: 'Auditoria',
    pages: [
      { key: 'audit_log', name: 'Audit Log', route: '/audit-log', actions: ['view', 'edit', 'admin'] },
    ],
  },
  {
    key: 'settings',
    name: 'Configuracoes',
    pages: [
      { key: 'settings', name: 'Configuracoes', route: '/settings', actions: ['view', 'edit', 'admin'] },
      { key: 'profile', name: 'Perfil', route: '/profile', actions: ['view', 'edit'] },
      { key: 'offline', name: 'Dados Offline', route: '/offline', actions: ['view', 'admin'] },
      { key: 'diagnostics', name: 'Diagnosticos', route: '/diagnostics', actions: ['view', 'admin'] },
    ],
  },
];

const VIEWER_PAGES = new Set([
  'equipment.dashboard',
  'equipment.equipment',
  'equipment.inspections',
  'equipment.certificates',
  'equipment.pending',
  'reports.reports',
  'alerts.alerts',
  'obs_cards.safety_observation',
  'obs_cards.reports',
  'evv.home',
  'evv.forms',
  'evv.history',
  'settings.profile',
]);

const TECHNICIAN_WRITE_PAGES = new Set([
  'equipment.equipment',
  'equipment.inspections',
  'equipment.maintenance',
  'equipment.certificates',
  'evv.forms',
  'obs_cards.safety_observation',
  'settings.profile',
]);

const SUPERVISOR_WRITE_PAGES = new Set([
  'equipment.inspections',
  'equipment.maintenance',
  'equipment.pending',
  'equipment.supervisor',
  'obs_cards.reports',
  'evv.history',
  'evv.review',
]);

export function getDefaultRolePermission(
  role: AppRole | null,
  moduleKey: string,
  pageKey: string,
  action: AccessAction,
): boolean {
  if (role === 'admin' || role === 'admin_master') return true;

  const pageId = `${moduleKey}.${pageKey}`;
  if (action === 'view') {
    if (role === 'viewer') return VIEWER_PAGES.has(pageId);
    if (role === 'technician') return VIEWER_PAGES.has(pageId) || TECHNICIAN_WRITE_PAGES.has(pageId) || moduleKey === 'health';
    if (role === 'supervisor') return VIEWER_PAGES.has(pageId) || TECHNICIAN_WRITE_PAGES.has(pageId) || SUPERVISOR_WRITE_PAGES.has(pageId) || moduleKey === 'health';
  }

  if (role === 'technician') {
    return ['create', 'edit'].includes(action) && TECHNICIAN_WRITE_PAGES.has(pageId);
  }

  if (role === 'supervisor') {
    if (['create', 'edit'].includes(action)) return TECHNICIAN_WRITE_PAGES.has(pageId) || SUPERVISOR_WRITE_PAGES.has(pageId);
    if (action === 'approve') return SUPERVISOR_WRITE_PAGES.has(pageId);
    if (action === 'export') return VIEWER_PAGES.has(pageId) || SUPERVISOR_WRITE_PAGES.has(pageId);
  }

  if (role === 'viewer') {
    if (pageId === 'obs_cards.safety_observation') return action === 'create';
    return action === 'export' && ['reports.reports', 'evv.history'].includes(pageId);
  }

  return false;
}

export function findAccessPageByRoute(pathname: string) {
  const allPages = ACCESS_MODULES.flatMap(module =>
    module.pages.map(page => ({ moduleKey: module.key, pageKey: page.key, route: page.route })),
  );

  return allPages
    .filter(page => pathname === page.route || (page.route !== '/' && pathname.startsWith(`${page.route}/`)))
    .sort((a, b) => b.route.length - a.route.length)[0];
}
