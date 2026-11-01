# chakh.in and www.chakh.in: certificate from ACM, DNS records in the existing Route 53 zone.
locals {
  has_domain = var.domain_name != ""
  site_names = local.has_domain ? [var.domain_name, "www.${var.domain_name}"] : []
}

data "aws_route53_zone" "site" {
  count = local.has_domain ? 1 : 0
  name  = var.domain_name
}

resource "aws_acm_certificate" "site" {
  count                     = local.has_domain ? 1 : 0
  provider                  = aws.us_east_1
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# allow_overwrite: ACM's validation record for a name is the same for every certificate in the
# account, so an older certificate's record may already be there.
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for o in(local.has_domain ? aws_acm_certificate.site[0].domain_validation_options : []) :
    o.domain_name => o
  }
  zone_id         = data.aws_route53_zone.site[0].zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "site" {
  count                   = local.has_domain ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.site[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# A and AAAA aliases to CloudFront for both names. allow_overwrite replaces whatever the
# records pointed at before.
resource "aws_route53_record" "site" {
  for_each = {
    for pair in setproduct(local.site_names, ["A", "AAAA"]) : "${pair[0]} ${pair[1]}" => pair
  }
  zone_id         = data.aws_route53_zone.site[0].zone_id
  name            = each.value[0]
  type            = each.value[1]
  allow_overwrite = true

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}
