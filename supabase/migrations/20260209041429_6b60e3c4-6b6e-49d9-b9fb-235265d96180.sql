
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_ship_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  today_str text := to_char(CURRENT_DATE, 'YYYY-MM-DD');
  thirty_days_later text := to_char(CURRENT_DATE + INTERVAL '30 days', 'YYYY-MM-DD');
  seven_days_later text := to_char(CURRENT_DATE + INTERVAL '7 days', 'YYYY-MM-DD');
  v_total int;
  v_active int;
  v_maintenance int;
  v_expired int;
  v_rejected int;
  v_inactive int;
  v_expired_certs int;
  v_pending_inspections int;
  v_pending_maint int;
  v_overdue_maint int;
  v_in_progress_maint int;
  v_compliance_rate numeric;
  v_by_category jsonb;
  v_by_status jsonb;
  v_alerts jsonb;
BEGIN
  -- Count by status
  SELECT 
    count(*),
    count(*) FILTER (WHERE status = 'active'),
    count(*) FILTER (WHERE status = 'maintenance'),
    count(*) FILTER (WHERE status = 'expired'),
    count(*) FILTER (WHERE status = 'rejected'),
    count(*) FILTER (WHERE status = 'inactive'),
    count(*) FILTER (WHERE certificate_expiry IS NOT NULL AND certificate_expiry < today_str),
    count(*) FILTER (WHERE next_inspection IS NOT NULL AND next_inspection <= thirty_days_later)
  INTO v_total, v_active, v_maintenance, v_expired, v_rejected, v_inactive, v_expired_certs, v_pending_inspections
  FROM equipment
  WHERE (p_ship_id IS NULL OR ship_id = p_ship_id);

  -- Auto-rejected: equipment whose certificate or expiry is past due
  -- These count as rejected even if stored status is different
  SELECT count(*) INTO v_rejected
  FROM equipment
  WHERE (p_ship_id IS NULL OR ship_id = p_ship_id)
    AND (
      status = 'rejected'
      OR (certificate_expiry IS NOT NULL AND certificate_expiry < today_str)
      OR (expiry_date IS NOT NULL AND expiry_date < today_str)
    );

  -- Recalculate active (not expired, not rejected, not inactive, not maintenance)
  SELECT count(*) INTO v_active
  FROM equipment
  WHERE (p_ship_id IS NULL OR ship_id = p_ship_id)
    AND status = 'active'
    AND (certificate_expiry IS NULL OR certificate_expiry >= today_str)
    AND (expiry_date IS NULL OR expiry_date >= today_str);

  -- Compliance rate
  IF v_total > 0 THEN
    v_compliance_rate := round(((v_total - v_rejected - v_inactive)::numeric / v_total) * 100, 1);
  ELSE
    v_compliance_rate := 0;
  END IF;

  -- Maintenance stats
  SELECT 
    count(*) FILTER (WHERE status IN ('pending', 'approved')),
    count(*) FILTER (WHERE status NOT IN ('completed', 'rejected') AND due_date IS NOT NULL AND due_date < today_str),
    count(*) FILTER (WHERE status = 'in_progress')
  INTO v_pending_maint, v_overdue_maint, v_in_progress_maint
  FROM maintenance_requests
  WHERE (p_ship_id IS NULL OR ship_id = p_ship_id);

  -- By category
  SELECT coalesce(jsonb_agg(row_to_json(cat_stats)), '[]'::jsonb)
  INTO v_by_category
  FROM (
    SELECT 
      coalesce(c.name, 'Sem Categoria') as category,
      count(*) as count,
      count(*) FILTER (WHERE e.status IN ('active', 'maintenance')
        AND (e.certificate_expiry IS NULL OR e.certificate_expiry >= today_str)
        AND (e.expiry_date IS NULL OR e.expiry_date >= today_str)
      ) as compliant,
      count(*) FILTER (WHERE e.status IN ('expired', 'rejected', 'inactive')
        OR (e.certificate_expiry IS NOT NULL AND e.certificate_expiry < today_str)
        OR (e.expiry_date IS NOT NULL AND e.expiry_date < today_str)
      ) as "nonCompliant"
    FROM equipment e
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE (p_ship_id IS NULL OR e.ship_id = p_ship_id)
    GROUP BY c.name
    ORDER BY count(*) DESC
  ) cat_stats;

  -- By status (effective status)
  v_by_status := jsonb_build_array(
    jsonb_build_object('status', 'active', 'count', v_active),
    jsonb_build_object('status', 'maintenance', 'count', v_maintenance),
    jsonb_build_object('status', 'expired', 'count', v_expired),
    jsonb_build_object('status', 'rejected', 'count', v_rejected),
    jsonb_build_object('status', 'inactive', 'count', v_inactive)
  );

  -- Alerts: expiring certificates + overdue inspections + rejected equipment (limit 15)
  SELECT coalesce(jsonb_agg(alert ORDER BY 
    CASE WHEN alert->>'severity' = 'high' THEN 0 
         WHEN alert->>'severity' = 'medium' THEN 1 
         ELSE 2 END
  ), '[]'::jsonb)
  INTO v_alerts
  FROM (
    -- Auto-rejected (expired cert or expiry date)
    SELECT jsonb_build_object(
      'id', 'alert-auto-rejected-' || e.id,
      'type', 'non_compliant',
      'message', 'Reprovado automaticamente',
      'messageKey', 'alerts.msgRejectedAuto',
      'equipmentId', e.id,
      'equipmentName', e.name || ' ' || e.internal_code,
      'date', today_str,
      'severity', 'high'
    ) as alert
    FROM equipment e
    WHERE (p_ship_id IS NULL OR e.ship_id = p_ship_id)
      AND (
        (e.certificate_expiry IS NOT NULL AND e.certificate_expiry < today_str)
        OR (e.expiry_date IS NOT NULL AND e.expiry_date < today_str)
      )
    
    UNION ALL
    
    -- Expiring soon certificates
    SELECT jsonb_build_object(
      'id', 'alert-expiring-' || e.id,
      'type', 'expiring',
      'message', 'Certificado expira em breve',
      'messageKey', 'alerts.msgCertificateExpiring',
      'equipmentId', e.id,
      'equipmentName', e.name || ' ' || e.internal_code,
      'date', e.certificate_expiry,
      'severity', 'medium'
    ) as alert
    FROM equipment e
    WHERE (p_ship_id IS NULL OR e.ship_id = p_ship_id)
      AND e.certificate_expiry IS NOT NULL
      AND e.certificate_expiry >= today_str
      AND e.certificate_expiry <= thirty_days_later
    
    UNION ALL
    
    -- Rejected by inspection
    SELECT jsonb_build_object(
      'id', 'alert-rejected-' || e.id,
      'type', 'non_compliant',
      'message', 'Equipamento reprovado em inspeção',
      'messageKey', 'alerts.msgEquipmentRejected',
      'equipmentId', e.id,
      'equipmentName', e.name || ' ' || e.internal_code,
      'date', today_str,
      'severity', 'high'
    ) as alert
    FROM equipment e
    WHERE (p_ship_id IS NULL OR e.ship_id = p_ship_id)
      AND e.status = 'rejected'
      AND (e.certificate_expiry IS NULL OR e.certificate_expiry >= today_str)
      AND (e.expiry_date IS NULL OR e.expiry_date >= today_str)
    
    UNION ALL
    
    -- Upcoming inspections (next 7 days)
    SELECT jsonb_build_object(
      'id', 'alert-inspection-' || e.id,
      'type', 'inspection_due',
      'message', 'Inspeção programada para esta semana',
      'messageKey', 'alerts.msgInspectionScheduled',
      'equipmentId', e.id,
      'equipmentName', e.name || ' ' || e.internal_code,
      'date', e.next_inspection,
      'severity', 'low'
    ) as alert
    FROM equipment e
    WHERE (p_ship_id IS NULL OR e.ship_id = p_ship_id)
      AND e.next_inspection IS NOT NULL
      AND e.next_inspection > today_str
      AND e.next_inspection <= seven_days_later
    
    UNION ALL
    
    -- Overdue maintenance
    SELECT jsonb_build_object(
      'id', 'alert-maint-overdue-' || m.id,
      'type', 'maintenance_overdue',
      'message', 'Manutenção atrasada: ' || m.title,
      'messageKey', CASE WHEN m.type = 'corrective' THEN 'alerts.msgMaintenanceCorrectiveOverdue' ELSE 'alerts.msgMaintenancePreventiveOverdue' END,
      'messageParams', jsonb_build_object('title', m.title),
      'equipmentId', m.equipment_id,
      'equipmentName', coalesce(eq.name || ' ' || eq.internal_code, 'Equipamento'),
      'date', m.due_date,
      'severity', 'high',
      'maintenanceId', m.id
    ) as alert
    FROM maintenance_requests m
    LEFT JOIN equipment eq ON eq.id = m.equipment_id
    WHERE (p_ship_id IS NULL OR m.ship_id = p_ship_id)
      AND m.status NOT IN ('completed', 'rejected')
      AND m.due_date IS NOT NULL
      AND m.due_date < today_str
    
    UNION ALL
    
    -- High/critical pending maintenance
    SELECT jsonb_build_object(
      'id', 'alert-maint-pending-' || m.id,
      'type', 'maintenance_pending',
      'message', 'Manutenção pendente: ' || m.title,
      'messageKey', CASE WHEN m.priority = 'critical' THEN 'alerts.msgMaintenanceCriticalPending' ELSE 'alerts.msgMaintenanceHighPending' END,
      'messageParams', jsonb_build_object('title', m.title),
      'equipmentId', m.equipment_id,
      'equipmentName', coalesce(eq.name || ' ' || eq.internal_code, 'Equipamento'),
      'date', coalesce(m.due_date, today_str),
      'severity', CASE WHEN m.priority = 'critical' THEN 'high' ELSE 'medium' END,
      'maintenanceId', m.id
    ) as alert
    FROM maintenance_requests m
    LEFT JOIN equipment eq ON eq.id = m.equipment_id
    WHERE (p_ship_id IS NULL OR m.ship_id = p_ship_id)
      AND m.priority IN ('critical', 'high')
      AND m.status = 'pending'
      AND (m.due_date IS NULL OR m.due_date >= today_str)

    LIMIT 15
  ) sub;

  result := jsonb_build_object(
    'totalEquipment', v_total,
    'activeEquipment', v_active,
    'expiredEquipment', v_expired,
    'expiredCertificates', v_expired_certs,
    'pendingInspections', v_pending_inspections,
    'complianceRate', v_compliance_rate,
    'byCategory', v_by_category,
    'byStatus', v_by_status,
    'recentAlerts', v_alerts,
    'pendingMaintenance', v_pending_maint,
    'overdueMaintenance', v_overdue_maint,
    'inProgressMaintenance', v_in_progress_maint
  );

  RETURN result;
END;
$$;
