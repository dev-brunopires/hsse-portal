
-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subdomain TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  logo_white_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create platform_owners table (app owners who can create organizations)
CREATE TABLE public.platform_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user_organizations table (links users to organizations)
CREATE TABLE public.user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Add organization_id to existing tables
ALTER TABLE public.ships ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.categories ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.notifications ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.checklist_templates ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.user_roles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- Update updated_at trigger for organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check if user is platform owner
CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_owners WHERE user_id = _user_id
  )
$$;

-- Create function to get user's organization id
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.user_organizations WHERE user_id = _user_id LIMIT 1
$$;

-- Create function to check if user belongs to organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(_user_id UUID, _organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations 
    WHERE user_id = _user_id AND organization_id = _organization_id
  ) OR public.is_platform_owner(_user_id)
$$;
