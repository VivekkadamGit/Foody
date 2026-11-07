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
| `storage.tf` | ECR image repository, private S3 bucket for static files, the server's environment in SSM Parameter Store |
| `github.tf` | GitHub's OIDC sign-in and the `chakh-github-deploy` role the workflow uses |
| `app.tf` | Lightsail container service (Nano: 0.25 vCPU / 512 MB) and its permission to pull from ECR |
| `cdn.tf` | CloudFront: `/_next/static/*` and `/brand/*` from S3, everything else to the server; a small function that passes the real host in `X-Forwarded-Host` |
| `dns.tf` | ACM certificate (us-east-1) for `chakh.in` + `www.chakh.in`, validated through Route 53, and the A/AAAA records pointing both at CloudFront |

## Who does what

**Terraform owns the infrastructure:** the container service and its size, CloudFront, DNS, the
bucket and the values in SSM. To change any of it, edit the `.tf` files or `terraform.tfvars`
and run `up.sh` again; on a running environment it only changes what differs.

**The deploy workflow only ships code.** On every push to `master` it:
1. builds the image and pushes it, tagged with the commit,
2. uploads the static files to S3,
3. creates a Lightsail deployment with that image and everything under `/chakh/` in SSM as the
   environment. Lightsail switches over once the new container passes `/api/health`; if it never
   does, the previous one keeps serving.

The workflow creates the deployments, not Terraform, because a fresh environment has no image
until the first run pushes one. So after a fresh `up.sh`, the site returns an error for a few
minutes until the deploy run it starts has finished. A changed value in SSM reaches the container
on the next deploy (`up.sh` starts one). While the environment is down, the workflow runs the
tests and skips the deploy with a notice instead of failing.

## Needs

- Terraform ≥ 1.5, the AWS CLI signed in to the `chakh` profile (`aws login --profile chakh`; set `AWS_PROFILE` to use another), and
  `gh` signed in.
- Secrets: `up.sh` reads them from `../.env.local`. Or copy `terraform.tfvars.example` to
  `terraform.tfvars`, which takes precedence.
- GitHub secrets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already set):
  they're compiled into the browser code at build time.

## Things to know

- **The site is https://chakh.in** (and www.chakh.in) after every `up`. The Route 53 hosted
  zone for `chakh.in` is deliberately *not* managed here: destroying and recreating it would give
  it new nameservers, and GoDaddy would have to be updated each time. `down.sh` removes only the
  records and the certificate. Supabase → Authentication → URL Configuration needs
  `https://chakh.in/auth/callback` and `https://chakh.in/admin/reset-password` (once).
- **Imported, not created:** the ECR repository, the static bucket, the GitHub OIDC provider and
  the four `/chakh/*` secrets existed before Terraform (from the earlier CloudFormation setup)
  and were brought in with `terraform import`. Terraform owns them now like everything else.
- **State is local** (`terraform.tfstate` in this folder, git-ignored). Keep it while the
  environment is up: without it, `down.sh` can't find what to remove.
- **Cost while up:** about $8 a month: $7 for Lightsail Nano, about $1 for the rest.
  `container_power = "micro"` → 1 GB memory for $10.
- **Dev-only setup:** the Lightsail URL is public and the environment is visible in its console.
  See "When to move off it" in `docs/deploy/aws.md`.
- **Nothing is kept after `down`:** images, static files and secrets go too. `up` rebuilds
  everything from `master`.
