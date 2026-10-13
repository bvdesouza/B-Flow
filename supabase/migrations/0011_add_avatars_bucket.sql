-- Create a storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Set up policies for the bucket
CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can upload an avatar."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can update their avatar."
  ON storage.objects FOR UPDATE
  WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can delete their avatar."
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'avatars' );
