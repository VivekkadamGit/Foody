# The Next.js server: a Lightsail container service with a fixed HTTPS URL. No VPC, load balancer
# or NAT to run. Terraform owns the service; the deploy workflow creates its deployments (image +
# environment from SSM), because the first one can only start once an image has been pushed.
resource "aws_lightsail_container_service" "app" {
  name  = local.name
  power = var.container_power
  scale = 1

  private_registry_access {
    ecr_image_puller_role {
      is_active = true
    }
  }
}

# Let the service pull from our private image repository.
resource "aws_ecr_repository_policy" "lightsail_pull" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowLightsailPull"
      Effect    = "Allow"
      Principal = { AWS = aws_lightsail_container_service.app.private_registry_access[0].ecr_image_puller_role[0].principal_arn }
      Action    = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
    }]
  })
}
