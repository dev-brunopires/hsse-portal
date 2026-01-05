import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Upload, Trash2, Edit, ExternalLink, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useIsPlatformOwner, useOrganizations, useCreateOrganization, useUpdateOrganization, useDeleteOrganization, Organization } from '@/hooks/useOrganizations';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';

export default function PlatformAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: isPlatformOwner, isLoading: isCheckingOwner } = useIsPlatformOwner();
  const { data: organizations, isLoading } = useOrganizations();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    subdomain: '',
    logo_url: '',
    logo_white_url: '',
  });
  const [adminData, setAdminData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingWhiteLogo, setUploadingWhiteLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const whiteLogoInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not platform owner
  if (!isCheckingOwner && !isPlatformOwner) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t('platformAdmin.accessDenied')}</CardTitle>
            <CardDescription>{t('platformAdmin.accessDeniedDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>{t('common.backToHome')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleLogoUpload = async (file: File, type: 'logo' | 'logo_white') => {
    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingWhiteLogo;
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${type}.${fileExt}`;
      const filePath = `${formData.slug || 'temp'}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('organization-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('organization-logos')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        [type === 'logo' ? 'logo_url' : 'logo_white_url']: publicUrl,
      }));

      toast({
        title: t('platformAdmin.logoUploaded'),
        description: t('platformAdmin.logoUploadedDesc'),
      });
    } catch (error: any) {
      toast({
        title: t('platformAdmin.uploadError'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.slug || !formData.subdomain) {
      toast({
        title: t('common.error'),
        description: t('platformAdmin.fillRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (editingOrg) {
      await updateOrg.mutateAsync({
        id: editingOrg.id,
        ...formData,
      });
    } else {
      // Validate admin data for new organization
      if (!adminData.email || !adminData.password || !adminData.fullName) {
        toast({
          title: t('common.error'),
          description: t('platformAdmin.fillAdminRequired'),
          variant: 'destructive',
        });
        return;
      }

      if (adminData.password.length < 6) {
        toast({
          title: t('common.error'),
          description: t('platformAdmin.passwordTooShort'),
          variant: 'destructive',
        });
        return;
      }

      setCreatingAdmin(true);
      try {
        // Create organization first
        const newOrg = await createOrg.mutateAsync(formData);

        // Create admin master user via edge function
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: adminData.email,
            password: adminData.password,
            fullName: adminData.fullName,
            role: 'admin_master',
            organizationId: newOrg.id,
          },
        });

        if (error) throw error;

        toast({
          title: t('platformAdmin.adminCreated'),
          description: t('platformAdmin.adminCreatedDesc', { email: adminData.email }),
        });
      } catch (error: any) {
        toast({
          title: t('platformAdmin.adminCreateError'),
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setCreatingAdmin(false);
      }
    }

    setIsCreateDialogOpen(false);
    setEditingOrg(null);
    setFormData({ name: '', slug: '', subdomain: '', logo_url: '', logo_white_url: '' });
    setAdminData({ email: '', password: '', fullName: '' });
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      subdomain: org.subdomain,
      logo_url: org.logo_url || '',
      logo_white_url: org.logo_white_url || '',
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('platformAdmin.confirmDelete'))) {
      await deleteOrg.mutateAsync(id);
    }
  };

  const handleSlugChange = (value: string) => {
    const slug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData(prev => ({
      ...prev,
      slug,
      subdomain: slug, // Auto-sync subdomain with slug
    }));
  };

  const getOrgUrl = (subdomain: string) => {
    // Generate real subdomain URL
    return `https://${subdomain}.safeship.app`;
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('platformAdmin.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('platformAdmin.description')}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingOrg(null);
              setFormData({ name: '', slug: '', subdomain: '', logo_url: '', logo_white_url: '' });
              setAdminData({ email: '', password: '', fullName: '' });
            }}>
              <Plus className="mr-2 h-4 w-4" />
              {t('platformAdmin.createOrganization')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingOrg ? t('platformAdmin.editOrganization') : t('platformAdmin.createOrganization')}
              </DialogTitle>
              <DialogDescription>
                {t('platformAdmin.organizationDialogDesc')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('platformAdmin.orgName')} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Modec, Petrobras..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">{t('platformAdmin.slug')} *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="modec"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('platformAdmin.slugHelp')}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">{t('platformAdmin.subdomain')} *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    value={formData.subdomain}
                    onChange={(e) => setFormData(prev => ({ ...prev, subdomain: e.target.value.toLowerCase() }))}
                    placeholder="modec"
                  />
                  <span className="text-muted-foreground whitespace-nowrap">.safeship.app</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('platformAdmin.colorLogo')}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file, 'logo');
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingLogo ? t('common.uploading') : t('common.upload')}
                    </Button>
                    {formData.logo_url && (
                      <img src={formData.logo_url} alt="Logo" className="h-10 object-contain" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('platformAdmin.whiteLogo')}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={whiteLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file, 'logo_white');
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => whiteLogoInputRef.current?.click()}
                      disabled={uploadingWhiteLogo}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingWhiteLogo ? t('common.uploading') : t('common.upload')}
                    </Button>
                    {formData.logo_white_url && (
                      <div className="bg-slate-800 p-2 rounded">
                        <img src={formData.logo_white_url} alt="White Logo" className="h-8 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Master Section - Only for new organizations */}
              {!editingOrg && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{t('platformAdmin.adminMasterSection')}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('platformAdmin.adminMasterDesc')}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="adminFullName">{t('platformAdmin.adminFullName')} *</Label>
                        <Input
                          id="adminFullName"
                          value={adminData.fullName}
                          onChange={(e) => setAdminData(prev => ({ ...prev, fullName: e.target.value }))}
                          placeholder="João Silva"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminEmail">{t('platformAdmin.adminEmail')} *</Label>
                        <Input
                          id="adminEmail"
                          type="email"
                          value={adminData.email}
                          onChange={(e) => setAdminData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="admin@empresa.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminPassword">{t('platformAdmin.adminPassword')} *</Label>
                      <Input
                        id="adminPassword"
                        type="password"
                        value={adminData.password}
                        onChange={(e) => setAdminData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={createOrg.isPending || updateOrg.isPending || creatingAdmin}>
                {creatingAdmin ? t('common.creating') : editingOrg ? t('common.save') : t('common.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('platformAdmin.organizations')}
          </CardTitle>
          <CardDescription>
            {t('platformAdmin.organizationsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : organizations && organizations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('platformAdmin.logo')}</TableHead>
                  <TableHead>{t('platformAdmin.orgName')}</TableHead>
                  <TableHead>{t('platformAdmin.subdomain')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('platformAdmin.accessLink')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="h-8 object-contain" />
                      ) : (
                        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {org.subdomain}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.is_active ? 'default' : 'secondary'}>
                        {org.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <a 
                        href={getOrgUrl(org.subdomain)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {t('platformAdmin.openApp')}
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(org)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(org.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('platformAdmin.noOrganizations')}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}
