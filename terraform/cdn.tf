# CloudFront: /_next/static/* and /brand/* from S3, everything else to the Lightsail server.
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_origin_access_control" "static" {
  name                              = "${local.name}-static"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Lightsail only answers on its own URL, so the visitor's Host can't go to the server. This hands
# the server the real one instead: server actions compare it with Origin, and sign-in links use it.
# It always overwrites, so a visitor can't supply their own.
resource "aws_cloudfront_function" "forward_host" {
  name    = "${local.name}-forward-host"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      request.headers['x-forwarded-host'] = { value: request.headers.host.value };
      return request;
    }
  JS
}

# Everything the visitor sent except Host: cookies (admin sign-in), query strings, headers.
resource "aws_cloudfront_origin_request_policy" "app" {
  name = "${local.name}-app"
  headers_config {
    header_behavior = "allExcept"
    headers {
      items = ["host"]
    }
  }
  cookies_config {
    cookie_behavior = "all"
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

locals {
  # The service's url is "https://<name>.<id>.<region>.cs.amazonlightsail.com/"; an origin wants the bare name.
  app_origin = trimsuffix(trimprefix(aws_lightsail_container_service.app.url, "https://"), "/")
}

resource "aws_cloudfront_distribution" "site" {
  enabled         = true
  comment         = "Chakh"
  http_version    = "http2and3"
  is_ipv6_enabled = true
  price_class     = var.price_class
  aliases         = local.site_names

  origin {
    origin_id   = "app"
    domain_name = local.app_origin
    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 30
    }
  }

  origin {
    origin_id                = "static"
    domain_name              = aws_s3_bucket.static.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.static.id
  }

  default_cache_behavior {
    target_origin_id         = "app"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.app.id
    compress                 = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.forward_host.arn
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = ["/_next/static/*", "/brand/*"]
    content {
      path_pattern           = ordered_cache_behavior.value
      target_origin_id       = "static"
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
      compress               = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.has_domain
    acm_certificate_arn            = local.has_domain ? aws_acm_certificate_validation.site[0].certificate_arn : null
    ssl_support_method             = local.has_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_domain ? "TLSv1.2_2021" : "TLSv1"
  }
}

resource "aws_s3_bucket_policy" "static" {
  bucket = aws_s3_bucket.static.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.static.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.static]
}
