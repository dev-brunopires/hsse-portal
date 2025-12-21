-- Add language preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN language text NOT NULL DEFAULT 'pt-BR';

-- Add comment explaining the column
COMMENT ON COLUMN public.profiles.language IS 'User preferred language: pt-BR for Portuguese (Brazil), en for English';