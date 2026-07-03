import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveDialog, ResponsiveDialogBody, ResponsiveDialogFooter } from '@/components/ui/responsive-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ACCESS_ACTIONS, ACCESS_MODULES, EMPTY_PERMISSION_FLAGS, type PermissionFlags } from '@/config/accessControl';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSaveUserAccessPermissions, useUserAccessPermissions, type UserPermissionRow } from '@/hooks/useAccess';
import type { ProfileWithRole } from '@/hooks/useProfiles';

interface UserAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRole | null;
}

type Matrix = Record<string, PermissionFlags>;

function matrixKey(moduleKey: string, pageKey: string) {
  return `${moduleKey}.${pageKey}`;
}

function buildInitialMatrix(rows: UserPermissionRow[]): Matrix {
  const matrix: Matrix = {};

  ACCESS_MODULES.forEach(module => {
    module.pages.forEach(page => {
      matrix[matrixKey(module.key, page.key)] = { ...EMPTY_PERMISSION_FLAGS };
    });
  });

  rows.forEach(row => {
    matrix[matrixKey(row.module_key, row.page_key)] = {
      can_view: row.can_view,
      can_create: row.can_create,
      can_edit: row.can_edit,
      can_delete: row.can_delete,
      can_approve: row.can_approve,
      can_export: row.can_export,
      can_admin: row.can_admin,
    };
  });

  return matrix;
}

export function UserAccessDialog({ open, onOpenChange, user }: UserAccessDialogProps) {
  const { organization } = useOrganization();
  const { data: rows = [], isLoading } = useUserAccessPermissions(user?.user_id);
  const savePermissions = useSaveUserAccessPermissions();
  const [matrix, setMatrix] = useState<Matrix>(() => buildInitialMatrix([]));

  useEffect(() => {
    if (open) setMatrix(buildInitialMatrix(rows));
  }, [open, rows]);

  const enabledCount = useMemo(
    () => Object.values(matrix).filter(flags => Object.values(flags).some(Boolean)).length,
    [matrix],
  );

  const setFlag = (moduleKey: string, pageKey: string, flag: keyof PermissionFlags, value: boolean) => {
    const key = matrixKey(moduleKey, pageKey);
    setMatrix(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? EMPTY_PERMISSION_FLAGS),
        [flag]: value,
        ...(flag !== 'can_view' && value ? { can_view: true } : {}),
      },
    }));
  };

  const setModuleView = (moduleKey: string, value: boolean) => {
    const module = ACCESS_MODULES.find(item => item.key === moduleKey);
    if (!module) return;

    setMatrix(prev => {
      const next = { ...prev };
      module.pages.forEach(page => {
        const key = matrixKey(moduleKey, page.key);
        next[key] = value
          ? { ...(next[key] ?? EMPTY_PERMISSION_FLAGS), can_view: true }
          : { ...EMPTY_PERMISSION_FLAGS };
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!user?.user_id || !organization?.id) return;

    const permissions = ACCESS_MODULES.flatMap(module =>
      module.pages.map(page => ({
        user_id: user.user_id,
        organization_id: organization.id,
        module_key: module.key,
        page_key: page.key,
        ...(matrix[matrixKey(module.key, page.key)] ?? EMPTY_PERMISSION_FLAGS),
      })),
    );

    await savePermissions.mutateAsync({ userId: user.user_id, permissions });
    toast.success('Permissoes salvas');
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Gerenciar Acessos"
      description={user ? `${user.full_name} - ${user.email}` : 'Selecione um usuario'}
      titleIcon={<KeyRound className="h-5 w-5 text-primary" />}
      className="sm:max-w-5xl"
    >
      <ResponsiveDialogBody>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Configure permissoes por modulo, pagina e acao.
              </span>
              <Badge variant="secondary">{enabledCount} paginas configuradas</Badge>
            </div>

            <Accordion type="multiple" className="space-y-3">
              {ACCESS_MODULES.map(module => {
                const moduleHasView = module.pages.some(page => matrix[matrixKey(module.key, page.key)]?.can_view);

                return (
                  <AccordionItem key={module.key} value={module.key} className="rounded-lg border px-3">
                    <AccordionTrigger>
                      <div className="flex items-center gap-3 text-left">
                        <Checkbox
                          checked={moduleHasView}
                          onClick={event => event.stopPropagation()}
                          onCheckedChange={value => setModuleView(module.key, Boolean(value))}
                        />
                        <div>
                          <p className="font-medium">{module.name}</p>
                          <p className="text-xs text-muted-foreground">{module.pages.length} paginas</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-52">Pagina</TableHead>
                              {ACCESS_ACTIONS.map(action => (
                                <TableHead key={action.key} className="text-center whitespace-nowrap">
                                  {action.label}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {module.pages.map(page => {
                              const row = matrix[matrixKey(module.key, page.key)] ?? EMPTY_PERMISSION_FLAGS;
                              return (
                                <TableRow key={page.key}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{page.name}</p>
                                      <p className="text-xs text-muted-foreground">{page.route}</p>
                                    </div>
                                  </TableCell>
                                  {ACCESS_ACTIONS.map(action => {
                                    const disabled = !page.actions.includes(action.key);
                                    return (
                                      <TableCell key={action.key} className="text-center">
                                        <Checkbox
                                          checked={row[action.flag]}
                                          disabled={disabled}
                                          onCheckedChange={value => setFlag(module.key, page.key, action.flag, Boolean(value))}
                                        />
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </ResponsiveDialogBody>

      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} disabled={!user || savePermissions.isPending}>
          {savePermissions.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar permissoes
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
