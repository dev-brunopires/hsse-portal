import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users as UsersIcon, 
  Shield, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  User,
  Crown,
  UserCheck,
  Plus,
  Ship,
  Anchor,
  MoreVertical,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { TableSkeleton, CardSkeleton } from '@/components/ui/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import i18n from '@/i18n';
import { useIsMobile } from '@/hooks/use-mobile';

const getRoleConfig = (t: (key: string) => string) => ({
  admin_master: { label: t('roles.admin_master'), variant: 'destructive' as const, icon: Crown, order: 0 },
  admin: { label: t('roles.admin'), variant: 'default' as const, icon: Shield, order: 1 },
  supervisor: { label: t('roles.supervisor'), variant: 'secondary' as const, icon: UserCheck, order: 2 },
  technician: { label: t('roles.technician'), variant: 'outline' as const, icon: User, order: 3 },
  viewer: { label: t('roles.viewer'), variant: 'outline' as const, icon: Eye, order: 4 },
});

export default function Users() {
  const { t } = useTranslation();
  const roleConfig = getRoleConfig(t);
  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;
  const isMobile = useIsMobile();
  
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
      <div className="space-y-6 animate-fade-in">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>

        {/* Stats Cards Skeleton */}
        <CardSkeleton count={4} />

        {/* Table Skeleton */}
        <TableSkeleton columns={6} rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={UsersIcon}
        title={t('usersPage.title')}
        subtitle={t('usersPage.subtitle')}
      />

      <Tabs defaultValue="users" className="space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="users" className="gap-2">
              <UsersIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('usersPage.usersTab')}</span>
              <span className="sm:hidden">{t('usersPage.usersTab')}</span>
            </TabsTrigger>
            <TabsTrigger value="ships" className="gap-2">
              <Ship className="h-4 w-4" />
              <span className="hidden sm:inline">{t('usersPage.shipsTab')}</span>
              <span className="sm:hidden">{t('usersPage.shipsTab')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('users.newUser')}
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UsersIcon className="h-4 w-4" />
                  {t('common.total')}
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
                  {t('roles.admin_master')}
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
                  {t('roles.admin')}
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
                  {t('roles.supervisor')}
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
                  {t('roles.technician')}
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
                  {t('roles.viewer')}
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
                  <CardTitle>{t('usersPage.systemUsers')}</CardTitle>
                  <CardDescription>{t('usersPage.allRegisteredUsers')}</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('usersPage.searchUsers')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile Card View */}
              {isMobile ? (
                <div className="space-y-3">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? t('usersPage.noUserFound') : t('usersPage.noUserRegistered')}
                    </div>
                  ) : (
                    filteredUsers.map((user) => {
                      const role = getUserRole(user);
                      const config = roleConfig[role] || roleConfig.viewer;
                      const isCurrentUser = user.user_id === currentUser?.id;
                      const isAdmin = (role as string) === 'admin' || (role as string) === 'admin_master';
                      const userShipsNames = getUserShipsNames(user.user_id);
                      
                      return (
                        <div key={user.id} className="border rounded-lg p-4 bg-card">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                  {user.full_name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">{user.full_name}</p>
                                  {isCurrentUser && (
                                    <span className="text-xs text-muted-foreground">({t('usersPage.you')})</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEdit(user)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  {t('usersPage.editData')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRoleChange(user)}>
                                  <Shield className="h-4 w-4 mr-2" />
                                  {t('usersPage.changeProfile')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleManageShips(user)}>
                                  <Anchor className="h-4 w-4 mr-2" />
                                  {t('usersPage.manageShips')}
                                </DropdownMenuItem>
                                {!isCurrentUser && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleDelete(user)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      {t('usersPage.removeUser')}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Badge variant={config.variant} className="gap-1">
                              <config.icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                            {isAdmin ? (
                              <Badge variant="outline" className="text-xs">
                                {t('usersPage.allShipsAccess')}
                              </Badge>
                            ) : userShipsNames.length > 0 ? (
                              <>
                                {userShipsNames.slice(0, 1).map((name, i) => (
                                  <Badge key={i} variant="outline" className="text-xs gap-1">
                                    <Ship className="h-3 w-3" />
                                    {name}
                                  </Badge>
                                ))}
                                {userShipsNames.length > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{userShipsNames.length - 1}
                                  </Badge>
                                )}
                              </>
                            ) : null}
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            {t('usersPage.registration')}: {format(new Date(user.created_at), "dd/MM/yyyy", { locale: dateLocale })}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Desktop Table View */
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('users.userName')}</TableHead>
                      <TableHead>{t('users.userEmail')}</TableHead>
                      <TableHead>{t('users.role')}</TableHead>
                      <TableHead>{t('usersPage.shipsTab')}</TableHead>
                      <TableHead>{t('usersPage.registration')}</TableHead>
                      <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {searchTerm ? t('usersPage.noUserFound') : t('usersPage.noUserRegistered')}
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
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
                                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                                    {user.full_name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{user.full_name}</p>
                                  {isCurrentUser && (
                                    <span className="text-xs text-muted-foreground">({t('usersPage.you')})</span>
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
                                <span className="text-xs text-muted-foreground italic">{t('usersPage.allShipsAccess')}</span>
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
                                <span className="text-xs text-muted-foreground">{t('common.none')}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(user.created_at), "dd/MM/yyyy", { locale: dateLocale })}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleEdit(user)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    {t('usersPage.editData')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleRoleChange(user)}>
                                    <Shield className="h-4 w-4 mr-2" />
                                    {t('usersPage.changeProfile')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleManageShips(user)}>
                                    <Anchor className="h-4 w-4 mr-2" />
                                    {t('usersPage.manageShips')}
                                  </DropdownMenuItem>
                                  {!isCurrentUser && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => handleDelete(user)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {t('usersPage.removeUser')}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ships Tab */}
        <TabsContent value="ships" className="space-y-6">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={handleNewShip}>
              <Plus className="h-4 w-4" />
              {t('ships.newShip')}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ship className="h-5 w-5" />
                    {t('usersPage.registeredShips')}
                  </CardTitle>
                  <CardDescription>
                    {t('usersPage.allSystemShips')}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('usersPage.searchShips')}
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
                  <p className="text-lg font-medium">{t('usersPage.noShipRegistered')}</p>
                  <p className="text-sm mb-4">{t('usersPage.allSystemShips')}</p>
                  <Button onClick={handleNewShip} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('ships.newShip')}
                  </Button>
                </div>
              ) : isMobile ? (
                /* Mobile Card View for Ships */
                <div className="space-y-3">
                  {filteredShips.map((ship) => {
                    const usersCount = allUserShips?.filter(us => us.ship_id === ship.id).length || 0;
                    
                    return (
                      <div key={ship.id} className="border rounded-lg p-4 bg-card">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Ship className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{ship.name}</p>
                              {ship.code && (
                                <p className="text-sm text-muted-foreground">{ship.code}</p>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEditShip(ship)}>
                                <Edit className="h-4 w-4 mr-2" />
                                {t('dialogs.editShip')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteShip(ship)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('dialogs.removeShip')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        {ship.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{ship.description}</p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Badge variant="secondary">
                            <UsersIcon className="h-3 w-3 mr-1" />
                            {usersCount} {t('dialogs.user').toLowerCase()}{usersCount !== 1 ? 's' : ''}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(ship.created_at), "dd/MM/yyyy", { locale: dateLocale })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Desktop Table View for Ships */
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('ships.shipName')}</TableHead>
                      <TableHead>{t('ships.shipCode')}</TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      <TableHead>{t('usersPage.usersTab')}</TableHead>
                      <TableHead>{t('usersPage.registration')}</TableHead>
                      <TableHead className="w-24 text-right">{t('common.actions')}</TableHead>
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
                              {usersCount} {t('dialogs.user').toLowerCase()}{usersCount !== 1 ? 's' : ''}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(ship.created_at), "dd/MM/yyyy", { locale: dateLocale })}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEditShip(ship)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  {t('dialogs.editShip')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteShip(ship)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('dialogs.removeShip')}
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
