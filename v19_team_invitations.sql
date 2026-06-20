-- v19: Create team_invitations table if not exists
-- This migration ensures the team_invitations table exists with all required columns.

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'OPERATOR',
  team_role TEXT DEFAULT 'CAPATAZ',
  permissions JSONB DEFAULT '{}',
  status TEXT DEFAULT 'PENDING',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_org_id ON team_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_inv_org_status ON team_invitations(org_id, status);
