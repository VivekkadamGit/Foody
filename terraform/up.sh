#!/usr/bin/env bash
# Create the Chakh AWS environment, then deploy master to it.
# Secrets come from terraform.tfvars if it exists, otherwise from ../.env.local.
set -euo pipefail
cd "$(dirname "$0")"

# Terraform can't read `aws login` sessions. Give it a profile whose credential_process asks the
# AWS CLI for them, so they are refreshed when they expire (CloudFront waits outlast them).
SOURCE_PROFILE="${AWS_PROFILE:-chakh}"
REAL_CONFIG="${AWS_CONFIG_FILE:-$HOME/.aws/config}"
TF_AWS_CONFIG="$(mktemp)"
trap 'rm -f "$TF_AWS_CONFIG"' EXIT
cat > "$TF_AWS_CONFIG" <<CONF
[profile terraform]
credential_process = env AWS_CONFIG_FILE=$REAL_CONFIG aws configure export-credentials --profile $SOURCE_PROFILE --format process
CONF
export AWS_CONFIG_FILE="$TF_AWS_CONFIG" AWS_PROFILE=terraform
REPO=VivekkadamGit/Foody

if [ ! -f terraform.tfvars ]; then
  env_value() { grep -E "^$1=" ../.env.local | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
  export TF_VAR_supabase_url="$(env_value NEXT_PUBLIC_SUPABASE_URL)"
  export TF_VAR_supabase_anon_key="$(env_value NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  export TF_VAR_supabase_service_role_key="$(env_value SUPABASE_SERVICE_ROLE_KEY)"
  export TF_VAR_gemini_api_key="$(env_value GEMINI_API_KEY)"
fi

terraform init -input=false
terraform apply "$@"

gh variable set AWS_REGION -R "$REPO" -b "$(terraform output -raw region)"
gh variable set AWS_DEPLOY_ROLE_ARN -R "$REPO" -b "$(terraform output -raw deploy_role_arn)"
gh variable set STATIC_BUCKET -R "$REPO" -b "$(terraform output -raw static_bucket)"
gh workflow run deploy-aws.yml -R "$REPO" --ref master

echo
echo "Infrastructure is up. The first deploy is running: gh run watch -R $REPO"
echo "Site: $(terraform output -raw site_url)  (live once that run finishes, ~5-8 min)"
echo "Supabase's redirect URLs need $(terraform output -raw site_url)/auth/callback and /admin/reset-password."
