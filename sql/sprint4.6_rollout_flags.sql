-- Migration: Sprint 4.6 Rollout Flags
-- Description: Create feature flags for gradual rollout, pilot regions, and War Room mode.

INSERT INTO public.cm_feature_flags (flag_key, is_active, active_regions, active_supervisor_ids)
VALUES 
  ('modulo_promotor_flutter', true, '{}'::VARCHAR(50)[], '{}'::UUID[]),
  ('command_center_production', true, '{}'::VARCHAR(50)[], '{}'::UUID[]),
  ('force_native_only', false, '{}'::VARCHAR(50)[], '{}'::UUID[]), -- Disabled initially for human pilot validation
  ('pilot_region_bh', true, '{}'::VARCHAR(50)[], '{}'::UUID[]),
  ('pilot_region_df', true, '{}'::VARCHAR(50)[], '{}'::UUID[]),
  ('pilot_region_sp', true, '{}'::VARCHAR(50)[], '{}'::UUID[]),
  ('war_room_enabled', true, '{}'::VARCHAR(50)[], '{}'::UUID[]) -- Enabled by default to monitor rollout
ON CONFLICT (flag_key) DO UPDATE SET is_active = EXCLUDED.is_active;
