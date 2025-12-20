import { useState } from 'react';
import { 
  Users as UsersIcon, 
  Shield, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  User,
  Loader2,
  Crown,
  UserCheck,
  Plus,
  Ship,
  Anchor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProfiles, type ProfileWithRole } from '@/hooks/useProfiles';
import { useShips, type Ship as ShipType } from '@/hooks/useShips';
import { useAllUserShips } from '@/hooks/useUserShips';
import { useAuth } from '@/contexts/AuthContext';
import { UserRoleDialog } from '@/components/users/UserRoleDialog';
import { UserEditDialog } from '@/components/users/UserEditDialog';
import { DeleteUserDialog } from '@/components/users/DeleteUserDialog';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { UserShipsDialog } from '@/components/users/UserShipsDialog';
import { ShipFormDialog } from '@/components/ships/ShipFormDialog';
import { DeleteShipDialog } from '@/components/ships/DeleteShipDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const roleConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ElementType; order: number }> = {
  admin_master: { label: 'Admin Master', variant: 'destructive', icon: Crown, order: 0 },
  admin: { label: 'Administrador', variant: 'default', icon: Shield, order: 1 },
  supervisor: { label: 'Supervisor', variant: 'secondary', icon: UserCheck, order: 2 },
  technician: { label: 'Técnico', variant: 'outline', icon: User, order: 3 },
  viewer: { label: 'Visualizador', variant: 'outline', icon: Eye, order: 4 },
};

export default function Users() {
  const { data: profiles, isLoading } = useProfiles();
  const { data: ships, isLoading: shipsLoading } = useShips();
  const { data: allUserShips } = useAllUserShips();
  const { user: currentUser } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [shipSearchTerm, setShipSearchTerm] = useState('');
  
  // User dialogs
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shipsDialogOpen, setShipsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileWithRole | null>(null);
  
  // Ship dialogs
  const [shipFormDialogOpen, setShipFormDialogOpen] = useState(false);
  const [deleteShipDialogOpen, setDeleteShipDialogOpen] = useState(false);
  const [selectedShip, setSelectedShip] = useState<ShipType | null>(null);

  const filteredUsers = profiles?.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.unit?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredShips = ships?.filter(ship =>
    ship.name.toLowerCase().includes(shipSearchTerm.toLowerCase()) ||
    ship.code?.toLowerCase().includes(shipSearchTerm.toLowerCase())
  ) || [];

  const userCounts = {
    total: profiles?.length || 0,
    adminMasters: profiles?.filter(u => (u.user_roles?.[0]?.role as string) === 'admin_master').length || 0,
    admins: profiles?.filter(u => (u.user_roles?.[0]?.role as string) === 'admin').length || 0,
    supervisors: profiles?.filter(u => (u.user_roles?.[0]?.role as string) === 'supervisor').length || 0,
    technicians: profiles?.filter(u => (u.user_roles?.[0]?.role as string) === 'technician').length || 0,
    viewers: profiles?.filter(u => (u.user_roles?.[0]?.role as string) === 'viewer').length || 0,
  };

  const getUserShipsCount = (userId: string) => {
    return allUserShips?.filter(us => us.user_id === userId).length || 0;
  };

  const getUserShipsNames = (userId: string) => {
    const userShipIds = allUserShips?.filter(us => us.user_id === userId).map(us => us.ship_id) || [];
    return ships?.filter(s => userShipIds.includes(s.id)).map(s => s.name) || [];
  };

  const handleRoleChange = (user: ProfileWithRole) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const handleEdit = (user: ProfileWithRole) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDelete = (user: ProfileWithRole) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleManageShips = (user: ProfileWithRole) => {
    setSelectedUser(user);
    setShipsDialogOpen(true);
  };

  const handleEditShip = (ship: ShipType) => {
    setSelectedShip(ship);
    setShipFormDialogOpen(true);
  };

  const handleDeleteShip = (ship: ShipType) => {
    setSelectedShip(ship);
    setDeleteShipDialogOpen(true);
  };

  const handleNewShip = () => {
    setSelectedShip(null);
    setShipFormDialogOpen(true);
  };

  const getUserRole = (user: ProfileWithRole) => {
    return user.user_roles?.[0]?.role || 'viewer';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie usuários, permissões e navios
          </p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <UsersIcon className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="ships" className="gap-2">
            <Ship className="h-4 w-4" />
            Navios
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo Usuário
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UsersIcon className="h-4 w-4" />
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{userCounts.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Admin Master
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{userCounts.adminMasters}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Admins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{userCounts.admins}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Supervisores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{userCounts.supervisors}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Técnicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{userCounts.technicians}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Visualizadores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-muted-foreground">{userCounts.viewers}</p>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Usuários do Sistema</CardTitle>
                  <CardDescription>Todos os usuários cadastrados</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuários..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Navios</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const role = getUserRole(user);
                      const config = roleConfig[role] || roleConfig.viewer;
                      const isCurrentUser = user.user_id === currentUser?.id;
                      const isAdmin = (role as string) === 'admin' || (role as string) === 'admin_master';
                      const userShipsNames = getUserShipsNames(user.user_id);
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {user.full_name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{user.full_name}</p>
                                {isCurrentUser && (
                                  <span className="text-xs text-muted-foreground">(você)</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={config.variant} className="gap-1">
                              <config.icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <span className="text-xs text-muted-foreground italic">Todos</span>
                            ) : userShipsNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {userShipsNames.slice(0, 2).map((name, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    <Ship className="h-3 w-3 mr-1" />
                                    {name}
                                  </Badge>
                                ))}
                                {userShipsNames.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{userShipsNames.length - 2}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Nenhum</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEdit(user)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar Dados
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRoleChange(user)}>
                                  <Shield className="h-4 w-4 mr-2" />
                                  Alterar Perfil
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleManageShips(user)}>
                                  <Anchor className="h-4 w-4 mr-2" />
                                  Gerenciar Navios
                                </DropdownMenuItem>
                                {!isCurrentUser && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleDelete(user)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remover Usuário
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ships Tab */}
        <TabsContent value="ships" className="space-y-6">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={handleNewShip}>
              <Plus className="h-4 w-4" />
              Novo Navio
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ship className="h-5 w-5" />
                    Navios Cadastrados
                  </CardTitle>
                  <CardDescription>
                    Gerencie os navios e controle de acesso por embarcação
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar navios..."
                    value={shipSearchTerm}
                    onChange={(e) => setShipSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {shipsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredShips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Ship className="h-16 w-16 mb-4" />
                  <p className="text-lg font-medium">Nenhum navio cadastrado</p>
                  <p className="text-sm mb-4">Cadastre navios para controlar acesso de usuários</p>
                  <Button onClick={handleNewShip} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Cadastrar Primeiro Navio
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Navio</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Usuários</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShips.map((ship) => {
                      const usersCount = allUserShips?.filter(us => us.ship_id === ship.id).length || 0;
                      
                      return (
                        <TableRow key={ship.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Ship className="h-5 w-5 text-primary" />
                              </div>
                              <span className="font-medium">{ship.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {ship.code || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {ship.description || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {usersCount} usuário{usersCount !== 1 ? 's' : ''}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(ship.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEditShip(ship)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar Navio
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteShip(ship)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover Navio
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Dialogs */}
      <UserRoleDialog 
        open={roleDialogOpen} 
        onOpenChange={setRoleDialogOpen} 
        user={selectedUser}
      />
      <UserEditDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
        user={selectedUser}
      />
      <DeleteUserDialog 
        open={deleteDialogOpen} 
        onOpenChange={setDeleteDialogOpen} 
        user={selectedUser}
      />
      <CreateUserDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />
      <UserShipsDialog
        open={shipsDialogOpen}
        onOpenChange={setShipsDialogOpen}
        user={selectedUser}
      />

      {/* Ship Dialogs */}
      <ShipFormDialog
        open={shipFormDialogOpen}
        onOpenChange={setShipFormDialogOpen}
        ship={selectedShip}
      />
      <DeleteShipDialog
        open={deleteShipDialogOpen}
        onOpenChange={setDeleteShipDialogOpen}
        ship={selectedShip}
      />
    </div>
  );
}
