-- Limpeza de dados operacionais
-- Esta migração remove todos os equipamentos, inspeções e manutenções

-- 1. Limpar dados de inspeções
TRUNCATE TABLE inspection_checklist_items CASCADE;
TRUNCATE TABLE inspection_photos CASCADE;
TRUNCATE TABLE inspections CASCADE;

-- 2. Limpar dados de manutenção
TRUNCATE TABLE maintenance_photos CASCADE;
TRUNCATE TABLE maintenance_logs CASCADE;
TRUNCATE TABLE maintenance_requests CASCADE;
TRUNCATE TABLE maintenance_plans CASCADE;

-- 3. Limpar dados de certificados e documentos
TRUNCATE TABLE certificate_renewals CASCADE;
TRUNCATE TABLE certificates CASCADE;
TRUNCATE TABLE equipment_documents CASCADE;
TRUNCATE TABLE equipment_transfers CASCADE;

-- 4. Limpar equipamentos
TRUNCATE TABLE equipment CASCADE;

-- 5. Limpar logs de auditoria (dados removidos não fazem mais sentido)
TRUNCATE TABLE audit_logs CASCADE;

-- 6. Limpar favoritos de entidades que não existem mais
DELETE FROM user_favorites 
WHERE entity_type IN ('equipment', 'inspection', 'maintenance');