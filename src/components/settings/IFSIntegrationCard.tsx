import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useIFSIntegration, IFSConfig } from '@/hooks/useIFSIntegration';
import { 
  Server, 
  RefreshCw, 
  Download, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Clock,
  Settings,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function IFSIntegrationCard() {
  const { 
    isLoading, 
    syncResult, 
    getConfig, 
    saveConfig, 
    testConnection, 
    syncEquipment 
  } = useIFSIntegration();

  const [config, setConfig] = useState<IFSConfig>({
    baseUrl: '',
    username: '',
    companyId: '',
    enabled: false,
    lastSync: null,
    syncInterval: 'manual',
  });
  const [showConfig, setShowConfig] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const savedConfig = getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [getConfig]);

  const handleSave = () => {
    saveConfig(config);
    setShowConfig(false);
  };

  const handleTestConnection = async () => {
    await testConnection({ ...config });
  };

  const handleSync = async (direction: 'import' | 'export') => {
    await syncEquipment(direction);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Integração IFS
            </CardTitle>
            <CardDescription>
              Sincronize equipamentos e inspeções com o sistema IFS ERP
            </CardDescription>
          </div>
          <Badge variant={config.enabled ? 'default' : 'secondary'}>
            {config.enabled ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Section */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            {config.enabled ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-sm">
                {config.enabled ? 'Conexão configurada' : 'Não configurado'}
              </p>
              {config.lastSync && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Última sincronização: {format(new Date(config.lastSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurar
          </Button>
        </div>

        {/* Configuration Form */}
        {showConfig && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ifs-url">URL do Servidor IFS</Label>
                  <Input
                    id="ifs-url"
                    placeholder="https://ifs.empresa.com/api"
                    value={config.baseUrl}
                    onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifs-company">ID da Empresa</Label>
                  <Input
                    id="ifs-company"
                    placeholder="EMPRESA01"
                    value={config.companyId}
                    onChange={(e) => setConfig({ ...config, companyId: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ifs-username">Usuário</Label>
                  <Input
                    id="ifs-username"
                    placeholder="usuario.ifs"
                    value={config.username}
                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifs-password">Senha</Label>
                  <Input
                    id="ifs-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A senha é armazenada de forma segura no backend
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sync-interval">Intervalo de Sincronização</Label>
                  <Select
                    value={config.syncInterval}
                    onValueChange={(value: 'manual' | 'hourly' | 'daily') => 
                      setConfig({ ...config, syncInterval: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="hourly">A cada hora</SelectItem>
                      <SelectItem value="daily">Diariamente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Habilitar Integração</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {config.enabled ? 'Integração ativa' : 'Integração desativada'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={isLoading}>
                  Salvar Configuração
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={isLoading || !config.baseUrl}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Testar Conexão
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Sync Actions */}
        {config.enabled && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Ações de Sincronização</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('import')}
                  disabled={isLoading}
                  className="justify-start"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Importar do IFS
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('export')}
                  disabled={isLoading}
                  className="justify-start"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Exportar para IFS
                </Button>
              </div>

              {syncResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  syncResult.success ? 'bg-green-500/10 text-green-700' : 'bg-destructive/10 text-destructive'
                }`}>
                  <p className="font-medium">
                    {syncResult.success ? 'Sincronização concluída' : 'Erro na sincronização'}
                  </p>
                  <p className="text-xs mt-1">
                    {syncResult.equipmentSynced} equipamentos, {syncResult.inspectionsSynced} inspeções
                  </p>
                  {syncResult.errors.length > 0 && (
                    <ul className="text-xs mt-2 list-disc list-inside">
                      {syncResult.errors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Mapping Info */}
        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Mapeamento de campos:</p>
          <p>• Código Interno → OBJECT_ID</p>
          <p>• Nome → OBJECT_DESC</p>
          <p>• Número de Série → SERIAL_NO</p>
          <p>• Status → STATUS (ACTIVE/WARNING/EXPIRED/MAINTENANCE)</p>
        </div>
      </CardContent>
    </Card>
  );
}
