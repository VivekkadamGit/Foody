#!/usr/bin/env bash
# Remove the whole Chakh AWS environment: server, load balancer, CloudFront, images,
# static files, secrets and the GitHub deploy role. Pushes to master then skip the deploy.
set -euo pipefail
cd "$(dirname "$0")"

# Terraform can't read `aws login` sessions; hand it the profile's temporary credentials.
eval "$(aws configure export-credentials --profile "${AWS_PROFILE:-chakh}" --format env)"
unset AWS_PROFILE

# destroy doesn't read the secrets, but Terraform still asks for every variable without a default.
if [ ! -f terraform.tfvars ]; then
  export TF_VAR_supabase_url=unused TF_VAR_supabase_anon_key=unused \
    TF_VAR_supabase_service_role_key=unused TF_VAR_gemini_api_key=unused
fi

terraform destroy "$@"
