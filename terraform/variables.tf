variable "region" {
  description = "Where the server runs. ap-southeast-2 (Sydney) sits next to the Supabase database."
  type        = string
  default     = "ap-southeast-2"
}

variable "github_repo" {
  description = "owner/name of the repository allowed to deploy."
  type        = string
  default     = "VivekkadamGit/Foody"
}

variable "deploy_branch" {
  type    = string
  default = "master"
}

variable "create_oidc_provider" {
  description = "false if the account already has GitHub's token.actions.githubusercontent.com identity provider."
  type        = bool
  default     = true
}

# ---------- Server secrets: stored in SSM Parameter Store, removed again on destroy ----------
variable "supabase_url" {
  type = string
}

variable "supabase_anon_key" {
  type      = string
  sensitive = true
}

variable "supabase_service_role_key" {
  type      = string
  sensitive = true
}

variable "gemini_api_key" {
  type      = string
  sensitive = true
}

variable "ai_search" {
  description = "\"off\" makes /search use keyword search only."
  type        = string
  default     = "on"
}

# ---------- Server size ----------
variable "container_power" {
  description = "Lightsail power. nano = 0.25 vCPU / 512 MB ($7/month); micro = 0.25 vCPU / 1 GB ($10/month)."
  type        = string
  default     = "nano"
}

# ---------- CloudFront ----------
variable "price_class" {
  description = "PriceClass_100 has no edge in India; PriceClass_200 does."
  type        = string
  default     = "PriceClass_200"
}

variable "domain_name" {
  description = <<-EOT
    The site's domain; www.<domain> is served too. Its Route 53 hosted zone must already exist
    (it's kept outside Terraform so destroy never changes the nameservers set at the registrar).
    Empty = only the cloudfront.net address.
  EOT
  type        = string
  default     = "chakh.in"
}
