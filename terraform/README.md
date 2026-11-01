# Chakh on AWS: Terraform

Creates the whole AWS environment with one command and removes it with another, so you pay
only while it's up. What runs where, and why: `docs/deploy/aws.md`.

```bash
terraform/up.sh     # create everything, then deploy master (~15 min the first time)
terraform/down.sh   # remove everything
```

Both show Terraform's plan and wait for you to type `yes`.

## What it creates

| File | Resources |
|---|---|
| `network.tf` | VPC, two public subnets, internet gateway (no NAT gateway) |
| `storage.tf` | ECR image repository, private S3 bucket for static files, server secrets in SSM Parameter Store |
| `github.tf` | GitHub's OIDC sign-in and the `chakh-github-deploy` role the workflow uses |
| `app.tf` | Load balancer (CloudFront-only), ECS cluster, task definition and Fargate Spot service (0.25 vCPU / 0.5 GB), logs |
| `cdn.tf` | CloudFront: `/_next/static/*` and `/brand/*` from S3, everything else to the server |

## Who does what

**Terraform owns the infrastructure, including the server's task definition** (size,
secrets, which image tag to run: `latest`). To change any of it, edit the `.tf` files or
`terraform.tfvars` and run `up.sh` again; on a running environment it only changes what differs.

**The deploy workflow only ships code.** On every push to `master` it:
1. builds the image and pushes it as `<commit sha>` and `latest`,
2. uploads the static files to S3,
3. asks ECS for a new rollout, which starts a server on the new `latest` image, switches over
   once it's healthy, and rolls back a broken one. ECS pins the exact image of each rollout,
   so a rollback really gets the previous build.

On a fresh `up.sh`, the server can't start until the first image exists, so ECS retries for a
few minutes until the deploy run that `up.sh` starts has pushed one. While the environment is
down, the workflow runs the tests and skips the deploy with a notice instead of failing.

## Needs

- Terraform ≥ 1.5, the AWS CLI signed in to the `chakh` profile (`aws login --profile chakh`; set `AWS_PROFILE` to use another), and
  `gh` signed in.
- Secrets: `up.sh` reads them from `../.env.local`. Or copy `terraform.tfvars.example` to
  `terraform.tfvars`, which takes precedence.
- GitHub secrets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already set):
  they're compiled into the browser code at build time.

## Things to know

- **The address changes on every `up`** (a new `*.cloudfront.net` name) unless you set
  `domain_name` + `certificate_arn`. Add the new address to Supabase → Authentication → URL
  Configuration (`/auth/callback` and `/admin/reset-password`), or password resets and invites
  won't land.
- **State is local** (`terraform.tfstate` in this folder, git-ignored). Keep it while the
  environment is up: without it, `down.sh` can't find what to remove.
- **Cost while up:** about $35 a month (≈ $1.20 a day). Most of that is the load balancer and its
  IP addresses; the Spot server is about $3 a month. `use_spot = false` → regular Fargate (≈ $11).
- **Nothing is kept after `down`:** images, static files and secrets go too. `up` rebuilds
  everything from `master`.
