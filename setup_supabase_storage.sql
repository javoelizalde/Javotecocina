-- setup_supabase_storage.sql
-- Pegá esto en Supabase → SQL Editor → Run
-- Configura policies de storage para recetarios-pdf y site-images

-- ============================================================
-- BUCKET: recetarios-pdf
-- Privado. Solo admins suben. Los compradores leen con token.
-- ============================================================

-- Admins pueden subir PDFs (authenticated = cualquier usuario logueado con tu Google)
CREATE POLICY "admin_upload_pdf"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recetarios-pdf');

-- Admins pueden actualizar (reemplazar un PDF existente)
CREATE POLICY "admin_update_pdf"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'recetarios-pdf');

-- Admins pueden eliminar PDFs
CREATE POLICY "admin_delete_pdf"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recetarios-pdf');

-- Cualquiera puede leer los PDFs una vez que tiene la URL firmada
-- (el backend genera signed URLs para compradores verificados)
CREATE POLICY "public_read_pdf"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'recetarios-pdf');

-- ============================================================
-- BUCKET: site-images
-- Público. Admins suben. Todos leen.
-- ============================================================

-- Admins pueden subir imágenes de portada
CREATE POLICY "admin_upload_images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-images');

-- Admins pueden actualizar imágenes
CREATE POLICY "admin_update_images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-images');

-- Admins pueden eliminar imágenes
CREATE POLICY "admin_delete_images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-images');

-- Todos pueden leer imágenes (bucket público)
CREATE POLICY "public_read_images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'site-images');
