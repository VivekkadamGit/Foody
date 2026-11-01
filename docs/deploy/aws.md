# Deploying Chakh on AWS

Every push to `master` deploys to AWS through `.github/workflows/deploy-aws.yml`.
Vercel keeps deploying too until you switch it off (see the end of this page).

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
deploy this same stack in `ap-south-1` (change the `AWS_REGION` variable and run the
bootstrap there). Then the whole round trip stays in India. Supabase can't move a project
in place — it means a new project and a data migration, so it's a separate job.

**Why ECS Fargate rather than Lambda.** The server is always on, so there are no cold
starts (a sleeping Lambda adds 1–3 s to the first search), and the one-hour search cache
and admin "save → page refreshes" work as they do today. One server is enough for now;
running two would need a shared cache first.

**The server is the cheapest Fargate option:** the smallest size (0.25 vCPU, 0.5 GB) on
Fargate Spot, about 70% below normal Fargate. The catch: AWS can take a Spot task back with
two minutes' notice. ECS starts a replacement, so the site can be down for a minute or two
when that happens. Set the stack parameter `CapacityProvider=FARGATE` to rule that out
(≈ $11 a month instead of ≈ $3). If the logs show the server running out of memory, raise
`TaskCpu`/`TaskMemory` to `512`/`1024`. (Graviton/ARM is cheaper than normal Fargate too, but
Fargate Spot doesn't run ARM, and Spot is the bigger saving.)

**Rough monthly cost (Sydney):** Fargate Spot ≈ $3, load balancer ≈ $20, public IPv4
addresses ≈ $11, CloudFront / S3 / ECR / logs ≈ $1–3 at current traffic (CloudFront's free
tier covers 1 TB and 10 M requests a month). About **$35 a month**, versus $0 on Vercel
Hobby. Most of it is the load balancer and its addresses, not the server.

## Files

| File | What it is |
|---|---|
| `Dockerfile` | Builds the Next.js standalone server (`output: 'standalone'` in `next.config.mjs`) |
| `infra/aws/bootstrap.yml` | One-time: image registry, static-files bucket, GitHub sign-in roles |
| `infra/aws/app.yml` | The app: network, load balancer, Fargate service, CloudFront, bucket policy |
| `.github/workflows/deploy-aws.yml` | Test → build image → upload static files to S3 → update the app stack |
| `app/api/health/route.ts` | Health check for the load balancer (doesn't touch Supabase) |

## One-time setup

Run these with an AWS admin profile. `REGION` is where the server runs.

```bash
export REGION=ap-southeast-2
```

**1. Bootstrap stack** (set `CreateOidcProvider=false` if your account already has GitHub's identity provider):

```bash
aws cloudformation deploy --region $REGION --stack-name chakh-bootstrap \
  --template-file infra/aws/bootstrap.yml --capabilities CAPABILITY_IAM \
  --parameter-overrides GitHubRepo=VivekkadamGit/Foody CreateOidcProvider=true
```

```bash
aws cloudformation describe-stacks --region $REGION --stack-name chakh-bootstrap \
  --query 'Stacks[0].Outputs' --output table
```

**2. Server secrets** in SSM Parameter Store (the values from `.env.local`):

```bash
for name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY GEMINI_API_KEY; do
  read -rs "value?$name: "; echo
  aws ssm put-parameter --region $REGION --name "/chakh/$name" --type SecureString --value "$value" --overwrite
done
```

**3. GitHub settings** (repo → Settings → Secrets and variables → Actions):

| Kind | Name | Value |
|---|---|---|
| Variable | `AWS_REGION` | `ap-southeast-2` |
| Variable | `AWS_DEPLOY_ROLE_ARN` | `DeployRoleArn` output |
| Variable | `AWS_CFN_EXEC_ROLE_ARN` | `CfnExecRoleArn` output |
| Variable | `STATIC_BUCKET` | `StaticBucket` output |
| Variable | `NEXT_PUBLIC_ENABLE_AI_SUGGEST` | optional, as in `.env.local` |
| Variable | `DOMAIN_NAME`, `CERTIFICATE_ARN` | optional, see "Custom domain" |
| Secret | `NEXT_PUBLIC_SUPABASE_URL` | from `.env.local` |
| Secret | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env.local` |
| Secret | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | from `.env.local` (optional) |
| Secret | `AWS_ORIGIN_SECRET` | output of `openssl rand -hex 32` |

The `NEXT_PUBLIC_*` values are needed at build time (they are written into the browser
JavaScript) as well as in SSM (the server reads them at run time).

**4. Deploy:** push to `master`, or Actions → "Deploy to AWS" → Run workflow. The first
run takes ~15 minutes (CloudFront is slow to create); later runs ~5–8 minutes. The site
address is printed in the run summary.

**5. Supabase redirect URLs:** add `https://<site address>/auth/callback` and
`https://<site address>/admin/reset-password` in Supabase → Authentication → URL
Configuration, or password resets and team invites won't land.

## Custom domain (optional)

1. Request a certificate for the domain in ACM **in `us-east-1`** (CloudFront only reads
   certificates from there) and validate it via DNS.
2. Set the `DOMAIN_NAME` and `CERTIFICATE_ARN` variables and re-run the workflow.
3. Point the domain at the `CloudFrontDomain` stack output (CNAME, or an alias record in Route 53).
4. Add the new address to Supabase's redirect URLs.

## Day to day

- **Logs:** CloudWatch → Log groups → `/ecs/chakh`.
- **Rollback:** a server that fails its health check is rolled back automatically. To go
  back to an older commit, re-run that commit's workflow run from the Actions tab.
- **Switch AI search off:** update the stack with `AiSearch=off`.
- **Turning off Vercel:** once AWS is serving the site, disconnect the repo in Vercel
  (Project → Settings → Git) so `master` is deployed in one place only.

## Security notes

- GitHub signs in with OIDC; no AWS keys are stored in GitHub. Only `master` (or the
  `production` environment) can assume the deploy role.
- The bucket is private; only this CloudFront distribution can read it.
- The load balancer accepts traffic only from CloudFront's address ranges, and only with
  the `X-Origin-Verify` secret header, so nobody can bypass CloudFront.
- The CloudFront → load balancer hop is plain HTTP (visitors still get HTTPS). To encrypt
  that hop too, add an HTTPS listener with a certificate for an `origin.` subdomain.
