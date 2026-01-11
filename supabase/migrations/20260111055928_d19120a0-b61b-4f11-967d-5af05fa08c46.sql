-- Create certificates table for document and certificate management
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  ship_id UUID REFERENCES public.ships(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Certificate info
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'certificate', -- certificate, document, license, permit, test_report
  certificate_number TEXT,
  issuer TEXT,
  
  -- Dates
  issue_date DATE,
  expiry_date DATE,
  renewal_date DATE,
  last_renewal_date DATE,
  
  -- File
  file_path TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'valid', -- valid, expiring_soon, expired, renewed, revoked
  renewal_status TEXT DEFAULT 'not_started', -- not_started, in_progress, completed, overdue
  
  -- Notes and metadata
  notes TEXT,
  renewal_notes TEXT,
  created_by UUID,
  renewed_by UUID,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_certificates_equipment ON public.certificates(equipment_id);
CREATE INDEX idx_certificates_organization ON public.certificates(organization_id);
CREATE INDEX idx_certificates_expiry ON public.certificates(expiry_date);
CREATE INDEX idx_certificates_status ON public.certificates(status);

-- Enable RLS
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view certificates from their org"
ON public.certificates FOR SELECT
USING (
  user_belongs_to_organization(auth.uid(), organization_id)
);

CREATE POLICY "Admins and technicians can manage certificates"
ON public.certificates FOR ALL
USING (
  user_belongs_to_organization(auth.uid(), organization_id) AND
  is_admin_or_technician(auth.uid())
)
WITH CHECK (
  user_belongs_to_organization(auth.uid(), organization_id) AND
  is_admin_or_technician(auth.uid())
);

CREATE POLICY "Platform owners can manage all certificates"
ON public.certificates FOR ALL
USING (is_platform_owner(auth.uid()))
WITH CHECK (is_platform_owner(auth.uid()));

-- Create certificate renewal history table
CREATE TABLE public.certificate_renewals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_id UUID NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  
  -- Renewal info
  previous_expiry_date DATE,
  new_expiry_date DATE NOT NULL,
  renewed_by UUID,
  renewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Files
  old_file_path TEXT,
  new_file_path TEXT,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for renewals
ALTER TABLE public.certificate_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view certificate renewals"
ON public.certificate_renewals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.certificates c
    WHERE c.id = certificate_renewals.certificate_id
    AND user_belongs_to_organization(auth.uid(), c.organization_id)
  )
);

CREATE POLICY "Admins and technicians can manage renewals"
ON public.certificate_renewals FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.certificates c
    WHERE c.id = certificate_renewals.certificate_id
    AND user_belongs_to_organization(auth.uid(), c.organization_id)
    AND is_admin_or_technician(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.certificates c
    WHERE c.id = certificate_renewals.certificate_id
    AND user_belongs_to_organization(auth.uid(), c.organization_id)
    AND is_admin_or_technician(auth.uid())
  )
);

-- Create function to update certificate status based on expiry
CREATE OR REPLACE FUNCTION public.update_certificate_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate status based on expiry_date
  IF NEW.expiry_date IS NULL THEN
    NEW.status := 'valid';
  ELSIF NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'expired';
    NEW.renewal_status := 'overdue';
  ELSIF NEW.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.status := 'expiring_soon';
    IF NEW.renewal_status = 'not_started' THEN
      NEW.renewal_status := 'not_started';
    END IF;
  ELSE
    NEW.status := 'valid';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic status updates
CREATE TRIGGER update_certificate_status_trigger
BEFORE INSERT OR UPDATE ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.update_certificate_status();

-- Create storage bucket for certificates if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for certificates bucket
CREATE POLICY "Users can view certificates files"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates' AND auth.role() = 'authenticated');

CREATE POLICY "Admins and technicians can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'certificates' AND is_admin_or_technician(auth.uid()));

CREATE POLICY "Admins and technicians can update certificates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'certificates' AND is_admin_or_technician(auth.uid()));

CREATE POLICY "Admins and technicians can delete certificates"
ON storage.objects FOR DELETE
USING (bucket_id = 'certificates' AND is_admin_or_technician(auth.uid()));