#!/usr/bin/env bash
# Remove the whole Chakh AWS environment: server, CloudFront, DNS records, certificate, images,
# static files, secrets and the GitHub deploy role. Pushes to master then skip the deploy.
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

# destroy doesn't read the secrets, but Terraform still asks for every variable without a default.
if [ ! -f terraform.tfvars ]; then
  export TF_VAR_supabase_url=unused TF_VAR_supabase_anon_key=unused \
    TF_VAR_supabase_service_role_key=unused TF_VAR_gemini_api_key=unused
fi

terraform destroy "$@"
