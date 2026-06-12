CREATE TABLE IF NOT EXISTS "terms_and_conditions_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_number" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_and_conditions_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_terms_acceptances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),

    CONSTRAINT "user_terms_acceptances_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_terms_acceptances" ADD CONSTRAINT "user_terms_acceptances_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_terms_acceptances" ADD CONSTRAINT "user_terms_acceptances_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "terms_and_conditions_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
