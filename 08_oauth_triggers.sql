-- 8단계: OAuth 사용자 자동 생성 트리거
-- Supabase SQL Editor에서 실행하세요

-- Function to handle new auth.users entries
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    username,
    email,
    oauth_id,
    oauth_provider,
    name,
    role,
    company_domain,
    company_name,
    profile_image,
    is_active,
    is_approved,
    created_at,
    updated_at,
    password
  ) VALUES (
    COALESCE(new.email, new.id::text),
    new.email,
    new.id::text,
    'oauth',
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email, 'Unknown User'),
    'employee',
    'namkyungsteel.com',
    '남경스틸(주)',
    new.raw_user_meta_data->>'avatar_url',
    true,
    false, -- 새 OAuth 사용자는 승인 대기 상태
    new.created_at,
    new.created_at,
    'oauth_user' -- OAuth 사용자는 비밀번호 대신 이 값을 사용
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update user on login
CREATE OR REPLACE FUNCTION public.update_user_on_login()
RETURNS trigger AS $$
BEGIN
  -- Update last_login_at in public.users
  UPDATE public.users
  SET 
    last_login_at = NOW(),
    updated_at = NOW()
  WHERE email = new.email OR oauth_id = new.id::text;
  
  -- If user doesn't exist in public.users, create it
  IF NOT FOUND THEN
    INSERT INTO public.users (
      username,
      email,
      oauth_id,
      oauth_provider,
      name,
      role,
      company_domain,
      company_name,
      profile_image,
      is_active,
      is_approved,
      created_at,
      updated_at,
      last_login_at,
      password
    ) VALUES (
      COALESCE(new.email, new.id::text),
      new.email,
      new.id::text,
      'oauth',
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email, 'Unknown User'),
      'employee',
      'namkyungsteel.com',
      '남경스틸(주)',
      new.raw_user_meta_data->>'avatar_url',
      true,
      false, -- 새 OAuth 사용자는 승인 대기 상태
      NOW(),
      NOW(),
      NOW(),
      'oauth_user'
    );
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auth.users updates (login)
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.update_user_on_login();