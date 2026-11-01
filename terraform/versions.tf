terraform {
  required_version = ">= 1.5"

  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

# Credentials come from the environment: up.sh / down.sh export them from the AWS CLI profile,
# because Terraform's AWS library can't read `aws login` sessions itself.
provider "aws" {
  region = var.region

  default_tags {
    tags = { Project = "chakh", ManagedBy = "terraform" }
  }
}

data "aws_caller_identity" "me" {}

locals {
  account = data.aws_caller_identity.me.account_id
  name    = "chakh"
}
