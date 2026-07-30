# AWS Operations Runbook
**Last updated:** 2026-07-30  
**Purpose:** Reference guide for developers when an AWS alert fires. You do not need to fix anything — read, understand, and contact the right person.

---

## Quick Escalation Card

| Name | Contact | Handles |
|------|---------|---------|
| Roshni | roshni@promactinfo.com | Infrastructure / RDS |
| Hasan | hasan@promactinfo.com | Application / ECS / EC2 |
| Jay | jay@promactinfo.com | RDS replication / WAF |
| Nishant | nishant@promactinfo.com | OpenSearch / ElastiCache (RCS) |
| Lakshya | lakshayaggarwal@promactinfo.com | Bedrock / AI |
| CM | CTO | PowerBI / general escalation |
| **Vivek (DevOps)** | **+91 6352266437** | **CRITICAL issues / anything complex** |
| Rushi S | CTO, Promact | Production down — absolute last resort |

---

## How to Use This Runbook

Find the service that triggered your alert. Read what it means. Check the severity. Contact the right person. **You do not need to fix anything yourself** — your job is to understand and escalate.

---

## Infrastructure Map

| Environment | Region | Key Services |
|---|---|---|
| Dev / QA | us-east-1 | visualogyx-dev, visualogyx-qa, inventory-ai-dev, vlx-marketing-dev |
| **Production** | **us-east-2** | **visualogyx-prod, vlx-marketing-prod** |

---

## Ground Rules (Read These First)

- **Dev/QA issues:** You can use Claude AI to investigate — paste the error and describe the scenario.
- **Restarts (dev/QA):** You may restart any EC2 or RDS in dev/QA — **EXCEPT MPI_SERVER** (never restart this).
- **Restarts (side projects):** inventory-ai and other non-Visualogyx services can be restarted — **EXCEPT vlx-marketing-prod**.
- **Dev/QA 503 errors:** Wait. A deployment is in progress and will stabilise on its own.
- **"4800ms" alert in uptime prod channel:** This is a timeout, not downtime. No action needed.
- **5XX on prod Report or AI Template:** These have no blue-green deployment. They will recover in a few minutes.
- **Most dev/QA issues are not showstoppers** — carry on with the broken thing unless prod is affected.
- **Prod ALB / WAF:** Do NOT make any changes. Even small changes can cause production outages.
- **For anything major or complex:** Call Vivek — +91 6352266437.

---

## RDS (Database) Alerts

### Low free storage alarm fires
The database disk is filling up. Check which database triggered the alarm.

**Higher risk DBs (no auto-scaling):** `visualogyx-rds-dev` (200 GB), `visualogyx-analytics` (20 GB), `vlx-marketing-dev` (20 GB), `vlx-marketing-prod` (20 GB)  
**Lower risk DBs (auto-scaling on):** `vlgx-rds-qa-encrypted`, `inventory-ai-dev`, `visualogyx-v3` (prod, max 1 TB, Multi-AZ)

**Action:** Contact **Hasan or Jay** to check if any table is missing in replication.  
**Severity:** HIGH

---

### DB instance unavailable / connection refused
The database is unreachable.

**Action:** Contact **Roshni + Vivek** immediately.  
**Severity:** CRITICAL

---

### High CPU on RDS
Database is under heavy query load.

**Action:** Contact **Roshni**.  
**Severity:** MEDIUM

---

### Connecting to prod RDS
Prod RDS is only accessible via the **Bastion Host - Windows** instance in us-east-2. You need credentials and access. Contact **Roshni, Hasan, or CM**.

---

## EC2 Alerts

### Instance stopped unexpectedly (Dev / QA)
A dev or QA server went down.

**Action:** Restart is allowed — go ahead. If it doesn't come back up, contact **Hasan**.  
**Severity:** MEDIUM  
**Exception:** Never restart **MPI_SERVER**.

---

### Instance stopped unexpectedly (Production)
A prod server went down.

**Action:** Contact **Hasan**. Do not restart prod instances without guidance.  
**Severity:** HIGH

---

### High CPU (>80%)
Server is under heavy load.

**Action:** Contact **Hasan**.  
**Severity:** MEDIUM

---

### Intentionally stopped instances (do not panic)
The following are stopped on purpose — no action needed:
- `dev-os-full-load` (us-east-1)
- `AI-SDLC-Windows` (us-east-1)
- `PowerBI Desktop` (us-east-2)

---

### PowerBI Gateway (prod)
If it goes down or shows high CPU, contact **CM**. Do not restart without guidance.

---

### Countit Detection Server (g4dn.xlarge, prod)
Used for an Instagram account only. Issues here are not a showstopper. No action needed.

---

### MPI_SERVER — DO NOT RESTART
Hosts: DB backup tool, Jira ticket enforce tool, S3 file notifications. If there is an issue, escalate to **Vivek**.

---

## ECS (Containers) Alerts

### App restarting repeatedly
The container keeps crashing and restarting.

**Action:**
1. Go to the ECS service → **Logs** tab — read the error
2. Go to the ECS service → **Events** tab — you'll find more context
3. Share the findings with **Hasan**

**Severity:** HIGH (prod) / MEDIUM (dev/QA)

---

### Service task count drops to 0
No containers are running for this service.

**Action (prod):** Contact **Hasan + Vivek** immediately.  
**Action (dev/QA):** Restart the ECS service. If it doesn't recover, contact **Hasan**.  
**Severity:** CRITICAL (prod) / HIGH (dev/QA)

---

### Deployment stuck / failing
A deploy is not completing.

**Action:** Check ECS deployment logs. Contact **Hasan** if unclear.  
**Severity:** MEDIUM

---

### AlarmLow alarms showing ALARM state
This is **normal**. AlarmLow means CPU is low and auto-scaling is scaling the service down. Not an incident.

---

### Side project ECS issues (inventory-ai, etc.)
Can restart freely — **excluding vlx-marketing-prod**.

---

## OpenSearch Alerts

### Dev cluster in YELLOW or RED status
This is common and usually self-corrects. **Wait** before escalating.

**If it doesn't recover:**
1. Check the SQS queue for backed-up messages
2. Check Lambda logs for related errors
3. Contact **Nishant**

**Severity:** LOW (if self-corrects) / MEDIUM (if persistent)

---

### Prod cluster issues
1. Check the SQS queue and Lambda logs for context
2. Contact **Nishant**

**Severity:** HIGH

---

## ElastiCache / Redis (RCS) Alerts

All RCS / ElastiCache issues → contact **Nishant**.

| Alert | Severity |
|-------|---------|
| High memory usage | HIGH |
| Connection spike | MEDIUM |

---

## SQS Queue Alerts

### Any SQS error
Failed messages automatically move to the **Dead Letter Queue (DLQ)**. Check the DLQ to read the failed messages and understand the error.

### DLQ depth growing
Messages are consistently failing to process.

**Action:** Contact **Hasan**. Messages can be redriven (resent) from the DLQ back to the main SQS queue once the root cause is fixed.  
**Severity:** HIGH

### Oldest message age growing
The queue is stalled — messages are not being processed.

**Action:** Contact **Hasan**.  
**Severity:** HIGH

---

## ALB / WAF Alerts (Prod)

> **Warning:** Do NOT make any changes to prod ALB or WAF rules. Even small changes can cause production outages. Read only — always escalate.

### High 5XX errors — Prod Report or AI Template
These services have **no blue-green deployment**. They will recover on their own within a few minutes. Monitor and wait.

### High 5XX errors — Main API or Web
**Action:** Contact **Hasan**.  
**Severity:** HIGH

### "4800ms" latency alert in uptime prod channel
This is a **timeout, not downtime**. No action needed.

### WAF blocking a request / Report Server blocked
**Action:** Contact **Jay + Hasan**. Do not touch WAF rules yourself.  
**Severity:** MEDIUM

### Unhealthy host count > 0
Load balancer cannot reach instances.

**Action:** Contact **Hasan** immediately.  
**Severity:** CRITICAL

---

## Bedrock (AI) Alerts

### Request from outside us-east-1 or us-east-2
**Ignore completely.** Not relevant.

### Bedrock input token alarm (`Bedrock-input-token-17k`)
Keep an eye on the chart in the Slack channel. Values should stay in the thousands. If they climb into the **hundreds of thousands (lacs)**, that is abnormal.

**Action:** Contact **Lakshya**.  
**Severity:** HIGH if values in lacs

### Cost alert / Lambda cost cutoff
Bedrock has a hard **$100/month cutoff** enforced via Lambda. If a cost-related alert fires, contact **Lakshya** immediately.

### Any other Bedrock error
Contact **Lakshya** — he owns everything Bedrock-related.

---

## SSM Parameter Store & Pipeline Issues

### Before adding or updating any SSM parameter
**Double-check** the parameter name, environment (dev/QA/prod), and value before saving. A wrong or missing parameter is the **#1 cause of ECS service failures**.

### ECS service failing to start after a deploy
Almost always a missing SSM parameter. Check the ECS task logs for `parameter not found` errors. Verify the parameter exists in SSM Parameter Store for the correct environment.

### Pipeline fails (CircleCI)
1. Check the pipeline logs for a clear error message
2. If nothing obvious, restart the pipeline once
3. If it fails again, investigate the logs before escalating to **Hasan**

### Android pipeline — Infisical integration
The Android pipeline syncs secrets from **Infisical**. Any secret added directly to Android secrets will be **automatically deleted** on the next sync because Infisical is the source of truth.

**Always add secrets to Infisical first.** They will sync to Android automatically. If a secret is missing from Android, look for it in Infisical.

---

## Lambda / MPI_SERVER Issues

### Lambda error
1. Check the **workflow or trigger** that invoked the Lambda
2. Check the **Lambda logs** in CloudWatch Logs
3. You will almost always find the root cause in those two places
4. If the cause is found but the fix is unclear, contact **Vivek**

### MPI_SERVER issues
Do NOT restart MPI_SERVER. It runs DB backup, Jira ticket enforce, and S3 file notifications. Escalate to **Vivek**.

---

## S3 Issues (Very Rare)

### Access errors / files missing
Check IAM permissions on the bucket.

**Action:** Contact **Roshni**.  
**Severity:** LOW (unless prod-facing)

---

## IAM / Permissions Issues

### "Access Denied" error for a developer
The developer is missing an IAM group membership.

**Action:** Contact **Roshni** with the developer's IAM username and the service they need access to.  
**Severity:** LOW

### New developer needs AWS access
Common IAM groups and what they grant:

| Group | Access |
|-------|--------|
| ReadOnly_Users | Read-only across most services |
| CloudWatch_Read_Only | View CloudWatch metrics and logs |
| SDE | Standard developer access |
| Sr_SDE | Senior developer access |
| Infra_Code_Diagnosis_Develoeprs | Infra diagnosis tools |

Ask **Roshni** to assign the appropriate group.

---

## When in Doubt

For anything major, complex, or that you can't figure out — **call Vivek directly: +91 6352266437**.

---

## Severity Reference

| Severity | Meaning | How to contact |
|----------|---------|---------------|
| LOW | No user impact, non-urgent | Email |
| MEDIUM | Degraded experience, service not down | Slack |
| HIGH | Feature broken or at risk | Slack + call |
| CRITICAL | Production down or data at risk | Call Vivek (+91 6352266437) and Rushi S (CTO Promact) |
