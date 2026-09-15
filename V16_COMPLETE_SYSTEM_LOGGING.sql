-- V16 Complete System Logging Upgrade
-- Non-destructive: expands logging only. Does NOT delete questions/candidates/exams.
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'event';
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS status_code integer;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS stack_trace text;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS environment text;

ALTER TABLE public.system_logs DROP CONSTRAINT IF EXISTS system_logs_level_check;
ALTER TABLE public.system_logs ADD CONSTRAINT system_logs_level_check
CHECK (level IN ('debug','info','warning','error','critical'));

CREATE INDEX IF NOT EXISTS system_logs_event_type_idx ON public.system_logs(event_type);
CREATE INDEX IF NOT EXISTS system_logs_status_code_idx ON public.system_logs(status_code);
CREATE INDEX IF NOT EXISTS system_logs_request_id_idx ON public.system_logs(request_id);
CREATE INDEX IF NOT EXISTS system_logs_error_code_idx ON public.system_logs(error_code);

CREATE OR REPLACE FUNCTION public.write_system_log(
  p_level text,
  p_source text,
  p_action text,
  p_message text,
  p_details jsonb DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_page text DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_event_type text DEFAULT 'event',
  p_status_code integer DEFAULT NULL,
  p_duration_ms integer DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_stack_trace text DEFAULT NULL,
  p_environment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.system_logs(
    level,source,action,event_type,message,details,user_id,user_email,page,request_id,
    status_code,duration_ms,error_code,stack_trace,environment
  )
  SELECT
    CASE WHEN p_level IN ('debug','info','warning','error','critical') THEN p_level ELSE 'info' END,
    left(coalesce(p_source,'unknown'),100),
    left(coalesce(p_action,'event'),150),
    left(coalesce(p_event_type,'event'),100),
    left(coalesce(p_message,'Unknown event'),2000),
    coalesce(p_details,'{}'::jsonb),
    coalesce(p_user_id,auth.uid()),
    CASE WHEN coalesce(p_user_id,auth.uid()) IS NOT NULL THEN
      (SELECT email FROM auth.users WHERE id=coalesce(p_user_id,auth.uid())) ELSE NULL END,
    left(p_page,300), left(p_request_id,150), p_status_code, p_duration_ms,
    left(p_error_code,100), left(p_stack_trace,8000), left(coalesce(p_environment,current_setting('app.environment',true)),50)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.write_system_log(text,text,text,text,jsonb,uuid,text,text,text,integer,integer,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_system_log(text,text,text,text,jsonb,uuid,text,text,text,integer,integer,text,text,text) TO anon, authenticated;
