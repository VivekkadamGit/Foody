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
   └── everything else  ──►  Next.js server on a Lightsail container (Sydney)
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
create the environment in `ap-south-1` (`region` variable in Terraform). Then the whole
round trip stays in India. Supabase can't move a project in place — it means a new project and a data migration, so it's a separate job.

**Why a Lightsail container.** We're in dev, so a low fixed price matters more than failover
and tight network controls. It's the same Docker image and the same size as a small Fargate
task (Nano: 0.25 vCPU, 512 MB), and it comes with a fixed HTTPS URL and health-checked
deploys, so no load balancer, VPC or IP addresses to pay for. The server is always on, so
there are no cold starts, and the one-hour search cache and admin "save → page refreshes"
work as usual. If the logs show it running out of memory, set `container_power = "micro"`
(1 GB, $10 a month).

**When to move off it:** before production. It gives up three things a real launch wants:
- The server's Lightsail URL is public, so anyone who finds it can bypass CloudFront.
- The secrets are plain environment variables on the deployment, visible in the Lightsail
  console (the source of truth stays encrypted in SSM).
- There's one server and no autoscaling.
ECS with a load balancer solves all three; that setup is in this repository's git history.

**Rough monthly cost (Sydney):** Lightsail Nano $7, CloudFront / S3 / ECR ≈ $1 at current
traffic (CloudFront's free tier covers 1 TB and 10 M requests a month). About **$8 a month**.

## Creating and removing it

The environment is managed with Terraform, so it can be created when needed and removed
afterwards: `terraform/up.sh` and `terraform/down.sh`. Details are in `terraform/README.md`.
Every push to `master` deploys through `.github/workflows/deploy-aws.yml` while the
environment is up, and skips the deploy while it's down.

| File | What it is |
|---|---|
| `Dockerfile` | Builds the Next.js standalone server (`output: 'standalone'` in `next.config.mjs`) |
| `terraform/` | All AWS resources, plus `up.sh` / `down.sh` |
| `.github/workflows/deploy-aws.yml` | Ships code only: test → push image → upload static files to S3 → Lightsail deployment |
| `app/api/health/route.ts` | Health check for the container (doesn't touch Supabase) |

## Day to day

- **Logs:** Lightsail console → Containers → `chakh` → Logs.
- **Rollback:** a container that fails its health check never takes over; the previous one
  keeps serving. To go back to an older commit, re-run that commit's workflow run from the
  Actions tab.
- **Switch AI search off, or change a secret:** set `ai_search = "off"` (or the secret) and run
  `terraform/up.sh`, which also starts a deploy so the container picks up the new value.

## Security notes

- GitHub signs in with OIDC; no AWS keys are stored in GitHub. Only `master` (or the
  `production` environment) can assume the deploy role.
- The bucket is private; only this CloudFront distribution can read it.
- CloudFront talks to the server over HTTPS.
- Dev-only trade-offs (see "When to move off it"): the server's Lightsail URL is public, and
  its environment is visible in the Lightsail console.
