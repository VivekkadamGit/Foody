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
variable "task_cpu" {
  description = "256 = 0.25 vCPU, the cheapest Fargate size."
  type        = number
  default     = 256
}

variable "task_memory" {
  type    = number
  default = 512
}

variable "use_spot" {
  description = "Fargate Spot is ~70% cheaper; AWS can reclaim the task with two minutes' notice (a minute or two of downtime)."
  type        = bool
  default     = true
}

# ---------- CloudFront ----------
variable "price_class" {
  description = "PriceClass_100 has no edge in India; PriceClass_200 does."
  type        = string
  default     = "PriceClass_200"
}

variable "domain_name" {
  description = "Optional custom domain, e.g. chakh.in. Empty = the cloudfront.net address."
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate for domain_name, in us-east-1 (CloudFront's rule)."
  type        = string
  default     = ""
}
