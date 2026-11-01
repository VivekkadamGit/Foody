output "site_url" {
  value = local.has_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "cloudfront_domain" {
  description = "Point a custom domain's DNS (CNAME / alias) here."
  value       = aws_cloudfront_distribution.site.domain_name
}

# The GitHub Actions variables the deploy workflow reads (up.sh sets them). The role and
# bucket names are fixed, so these stay the same across destroy + apply.
output "region" {
  value = var.region
}

output "deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

output "static_bucket" {
  value = aws_s3_bucket.static.bucket
}
