# Deploying Chakh on AWS

Chakh runs on AWS in an environment you create and remove with Terraform (`terraform/`).

## The plan: what goes where, and why

```
Visitor (Surat, Vadodara…)
   │  HTTPS
   ▼
CloudFront edge in India (Mumbai / Delhi / Chennai …)
   ├── /_next/static/*  ──►  S3 bucket   (JS, CSS, fonts — cached at the edge for a year)
   ├── /brand/*         ──►  S3 bucket   (logos — cached for a day)
   └── everything else  ──►  Load balancer ──► Next.js server on ECS Fargate (Sydney)
                                                   ├── Supabase Postgres (Sydney)
                                                   └── Gemini
```

**Static files stay in S3.** After the first visit, the JavaScript, CSS and fonts come
from a CloudFront edge in India in a few milliseconds and never touch the server. File
names contain a content hash, so they are cached for a year with no risk of stale code.
Old builds' files are never deleted, so a page someone opened before a deploy still works.

**Pages are not cached.** Search, admin and every page that reads Supabase are rendered
fresh on each request (CloudFront only forwards them), because they show live data and
signed-in admins. Search answers are still cached for an hour inside the server.

**Why the server runs in Sydney (`ap-southeast-2`), not Mumbai.** The database is in
Sydney. One search makes several database calls one after another, plus a Gemini call.
A server in Mumbai would pay India→Sydney (~150 ms) on *every* database call; a server
in Sydney pays it once, on the CloudFront→server hop, which runs on AWS's own network.

**The bigger speed-up, later:** move the Supabase project to Mumbai (`ap-south-1`) and
create the environment in `ap-south-1` (`region` variable in Terraform). Then the whole round trip stays in India. Supabase can't move a project
in place — it means a new project and a data migration, so it's a separate job.

**Why ECS Fargate rather than Lambda.** The server is always on, so there are no cold
starts (a sleeping Lambda adds 1–3 s to the first search), and the one-hour search cache
and admin "save → page refreshes" work as they do today. One server is enough for now;
running two would need a shared cache first.

**The server is the cheapest Fargate option:** the smallest size (0.25 vCPU, 0.5 GB) on
Fargate Spot, about 70% below normal Fargate. The catch: AWS can take a Spot task back with
two minutes' notice. ECS starts a replacement, so the site can be down for a minute or two
when that happens. Set `use_spot = false` in Terraform to rule that out
(≈ $11 a month instead of ≈ $3). If the logs show the server running out of memory, raise
`task_cpu`/`task_memory` to `512`/`1024`. (Graviton/ARM is cheaper than normal Fargate too, but
Fargate Spot doesn't run ARM, and Spot is the bigger saving.)

**Rough monthly cost (Sydney):** Fargate Spot ≈ $3, load balancer ≈ $20, public IPv4
addresses ≈ $11, CloudFront / S3 / ECR / logs ≈ $1–3 at current traffic (CloudFront's free
tier covers 1 TB and 10 M requests a month). About **$35 a month**, versus $0 on Vercel
Hobby. Most of it is the load balancer and its addresses, not the server.

## Creating and removing it

The environment is managed with Terraform, so it can be created when needed and removed
afterwards: `terraform/up.sh` and `terraform/down.sh`. Details are in `terraform/README.md`.
Every push to `master` deploys through `.github/workflows/deploy-aws.yml` while the
environment is up, and skips the deploy while it's down.

| File | What it is |
|---|---|
| `Dockerfile` | Builds the Next.js standalone server (`output: 'standalone'` in `next.config.mjs`) |
| `terraform/` | All AWS resources, plus `up.sh` / `down.sh` |
| `.github/workflows/deploy-aws.yml` | Ships code only: test → push image (`latest`) → upload static files to S3 → ECS rollout |
| `app/api/health/route.ts` | Health check for the load balancer (doesn't touch Supabase) |

## Day to day

- **Logs:** CloudWatch → Log groups → `/ecs/chakh`.
- **Rollback:** a server that fails its health check is rolled back automatically. To go
  back to an older commit, re-run that commit's workflow run from the Actions tab (it pushes
  that build as `latest` again).
- **Switch AI search off:** set `ai_search = "off"` and run `terraform/up.sh` (on a running
  environment it only changes what differs).

## Security notes

- GitHub signs in with OIDC; no AWS keys are stored in GitHub. Only `master` (or the
  `production` environment) can assume the deploy role.
- The bucket is private; only this CloudFront distribution can read it.
- The load balancer accepts traffic only from CloudFront's address ranges, and only with
  a secret `X-Origin-Verify` header Terraform generates, so nobody can bypass CloudFront.
- The CloudFront → load balancer hop is plain HTTP (visitors still get HTTPS). To encrypt
  that hop too, add an HTTPS listener with a certificate for an `origin.` subdomain.
