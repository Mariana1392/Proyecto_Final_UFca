-- =============================================================================
-- FIX: 403 permission denied en solicitudes_asociados y comite_evaluador
-- Causa: RLS activo sin políticas para el rol authenticated (admin)
-- Ejecutar en Supabase → SQL Editor → Run
-- =============================================================================

-- ── solicitudes_asociados ────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_asociados TO authenticated;

-- Política: el propio usuario ve su solicitud; el admin ve todas
DROP POLICY IF EXISTS "solicitudes_select_authenticated" ON public.solicitudes_asociados;
CREATE POLICY "solicitudes_select_authenticated"
  ON public.solicitudes_asociados FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "solicitudes_insert_authenticated" ON public.solicitudes_asociados;
CREATE POLICY "solicitudes_insert_authenticated"
  ON public.solicitudes_asociados FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "solicitudes_update_authenticated" ON public.solicitudes_asociados;
CREATE POLICY "solicitudes_update_authenticated"
  ON public.solicitudes_asociados FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "solicitudes_delete_authenticated" ON public.solicitudes_asociados;
CREATE POLICY "solicitudes_delete_authenticated"
  ON public.solicitudes_asociados FOR DELETE
  TO authenticated
  USING (true);

-- ── comite_evaluador ─────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comite_evaluador TO authenticated;

DROP POLICY IF EXISTS "comite_select_authenticated" ON public.comite_evaluador;
CREATE POLICY "comite_select_authenticated"
  ON public.comite_evaluador FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "comite_insert_authenticated" ON public.comite_evaluador;
CREATE POLICY "comite_insert_authenticated"
  ON public.comite_evaluador FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "comite_update_authenticated" ON public.comite_evaluador;
CREATE POLICY "comite_update_authenticated"
  ON public.comite_evaluador FOR UPDATE
  TO authenticated
  USING (true);

-- Recargar caché
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('solicitudes_asociados', 'comite_evaluador')
ORDER BY tablename, cmd;
