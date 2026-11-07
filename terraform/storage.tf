# Container images. force_delete: destroy removes the images too.
resource "aws_ecr_repository" "app" {
  name         = local.name
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 20 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }
      action       = { type = "expire" }
    }]
  })
}

# /_next/static/* and /brand/*, read only by CloudFront (policy in cdn.tf).
# No expiry rule: unchanged hashed files are not re-uploaded, so age says nothing about use.
resource "aws_s3_bucket" "static" {
  bucket        = "${local.name}-static-${local.account}-${var.region}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "static" {
  bucket                  = aws_s3_bucket.static.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "static" {
  bucket = aws_s3_bucket.static.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# The server's environment. The deploy workflow passes everything under /chakh/ to the container;
# it goes away with the rest on destroy.
locals {
  secrets = {
    NEXT_PUBLIC_SUPABASE_URL      = var.supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY = var.supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY     = var.supabase_service_role_key
    GEMINI_API_KEY                = var.gemini_api_key
    AI_SEARCH                     = var.ai_search
  }
}

resource "aws_ssm_parameter" "secret" {
  for_each = toset(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY", "AI_SEARCH"])
  name     = "/${local.name}/${each.key}"
  type     = "SecureString"
  value    = local.secrets[each.key]
}
