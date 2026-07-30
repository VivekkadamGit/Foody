---
title: AWS Operations Runbook — Design Spec
date: 2026-07-30
status: approved
---

# AWS Operations Runbook — Design Spec

## Purpose

A Confluence document that lets developers understand what is happening when an AWS alert fires while the on-call infra person is on leave. Developers do not take action — they read, understand severity, and contact the right admin.

## Audience

Developers with limited AWS access. Minimal remediation allowed (see per-service rules below). Diagnose + escalate for anything beyond those rules.

## Key Operational Rules (applies across all services)

- **us-east-1 (dev/QA):** Developers can use Claude AI to investigate — paste the error and describe the scenario, Claude can help diagnose.
- **Restarts allowed:** Any EC2 or RDS in dev/QA can be restarted freely — **EXCEPT MPI_SERVER** (never restart).
- **Side projects** (inventory-ai, any non-Visualogyx service): Can be restarted freely — **EXCEPT vlx-marketing-prod**.
- **Dev/QA 503 errors:** Wait. A deployment is probably in progress — it will stabilise on its own.
- **"4800ms" latency alert in uptime prod channel:** This is a timeout, not a downtime. No action needed.
- **5XX on prod report or AI template:** No blue-green deployment on these services. They will recover in a few minutes on their own.
- **Most dev/QA issues are not showstoppers** — carry on with the broken thing unless prod is affected.
- **MPI_SERVER hosts:** DB backup tool, Jira ticket enforce tool, S3 file notifications — these are also spread across Lambda. If MPI issues arise, do not restart — escalate to Vivek.

## Escalation Contacts

| Name | Contact | Role |
|------|---------|------|
| Roshni | roshni@promactinfo.com | Infrastructure / RDS |
| Hasan | hasan@promactinfo.com | Application / ECS / EC2 |
| Jay | jay@promactinfo.com | RDS replication issues / WAF |
| Nishant | nishant@promactinfo.com | OpenSearch / ElastiCache (RCS) |
| Lakshya | lakshayaggarwal@promactinfo.com | Bedrock / AI |
| CM | CTO | Escalate if neither responds or prod is down |
| Vivek (DevOps) | +91 6352266437 | CRITICAL issues — call if Roshni/Hasan unreachable |
| Rushi S | CTO, Promact | CRITICAL production-down — last resort |

## Infrastructure Overview

### us-east-1 (Dev / QA)

**RDS**
| Instance | Engine | Size | Auto-Scale | Risk |
|----------|--------|------|-----------|------|
| visualogyx-rds-dev | Postgres | 200 GB | No | High — no safety net |
| vlgx-rds-qa-encrypted | Postgres | 121 GB | Yes | Low |
| inventory-ai-dev | Postgres | 20 GB | Yes | Low |
| visualogyx-analytics | Postgres | 20 GB | No | High — no safety net |
| vlx-marketing-dev | Postgres | 20 GB | No | High — no safety net |

**EC2**
| Name | State | Type |
|------|-------|------|
| vs-dev-api | running | t3.large |
| vs-dev-web | running | t3.medium |
| vs-qa-api | running | t3.large |
| vs-qa-web | running | t3.medium |
| vs-dev-report-ecs | running | t3.large |
| vs-qa-report-ecs | running | t3.large |
| vs-dev-ai-template-ecs | running | t3.medium |
| vlx-marketing-dev | running | t3.medium |
| MPI_SERVER | running | t3.large |
| dev-os-full-load | **stopped** (intentional) | m6i.large |
| AI-SDLC-Windows | **stopped** (intentional) | t3.medium |

**ECS Clusters:** vs-dev, vs-qa, vlx-marketing-dev, inventory-ai-dev, default

**CloudWatch Alarms:** dev-rds-space-alarm-60gb, qa-rds-space-alarm-30gb, dev-api-key-expiry-dlq-depth

---

### us-east-2 (Production)

**RDS**
| Instance | Engine | Size | Auto-Scale | Multi-AZ | Risk |
|----------|--------|------|-----------|---------|------|
| visualogyx-v3 | Postgres | 110 GB | Yes (max 1 TB) | Yes | Low — well protected |
| visualogyxanalyticsprod | Postgres | 30 GB | Yes | No | Medium |
| vlx-marketing-prod | Postgres | 20 GB | No | No | High — no safety net |

**EC2**
| Name | State | Type |
|------|-------|------|
| Prod-API-Server | running | m5.xlarge |
| Prod-Web-Server (×2) | running | t3.medium |
| vlgx-report-prod-ecs | running | r5.large |
| Prod-AITemplate-Server | running | t3.medium |
| Countit Detection Server | running | g4dn.xlarge (GPU) |
| vlx-marketing-prod (×2) | running | t3.large |
| Bastion Host - Windows | running | t3.large |
| PowerBI Gateway | running | t3.medium |
| PowerBI Desktop | **stopped** (intentional) | t3.xlarge |

**ECS Clusters:** vlgx-latest (main prod), visualogyx-prod-socket, vlx-marketing-prod

**Additional Prod Services:** OpenSearch (prod-visualogyx-opensearch), ElastiCache/Redis (ec-visualogyx-prod), SQS (5 queues), WAF, ALB (visualogyx-prod-loadbalancer-v3)

---

## Document Structure (Confluence Page)

### 1. Header — Quick Escalation Card
Prominent info-box with all three contacts and when to use each.

### 2. How to Use This Runbook
3 sentences. Find your alert. Read what it means. Contact the right person.

### 3. Infrastructure Map
Table: environment → region → services → projects.

### 4. RDS (Database) Alerts
Alert entries (alert-first format):
- **Low free storage alarm fires** — what it means, which DBs have no auto-scale (risk), severity HIGH; contact Hasan or Jay to check if any table is missing in replication
- **DB instance unavailable / connection refused** — severity CRITICAL, contact Roshni + Vivek
- **High CPU on RDS** — severity MEDIUM, contact Roshni

### 5. EC2 Alerts
- **Instance stopped unexpectedly (dev/QA)** — severity MEDIUM; restart is allowed except MPI_SERVER; contact Hasan if restart doesn't fix it
- **Instance stopped unexpectedly (prod)** — severity HIGH, contact Hasan; do not restart prod without guidance
- **High CPU (>80%)** — severity MEDIUM, contact Hasan
- **Note on intentionally stopped instances** — `dev-os-full-load`, `AI-SDLC-Windows`, `PowerBI Desktop` are intentionally stopped. No action needed.
- **Countit Detection Server (g4dn.xlarge, prod)** — used for an Instagram account only; issues here are not a showstopper. No action needed.
- **PowerBI Gateway (prod)** — if it goes down or shows high CPU, contact CM. Do not restart without guidance.
- **MPI_SERVER** — DO NOT restart under any circumstances. Escalate to Vivek.
- **Bastion Host - Windows (prod)** — used to connect to any prod RDS instance. If you need prod DB access or the Bastion goes down, contact Roshni, Hasan, or CM.

### 6. ECS (Containers) Alerts
- **App restarting repeatedly** — check ECS logs first, then check ECS events tab; both will give insights into the crash reason; share findings with Hasan
- **Service task count drops to 0 (prod)** — severity CRITICAL, contact Hasan + Vivek
- **Service task count drops to 0 (dev/QA)** — severity HIGH, restart is allowed, contact Hasan if it persists
- **Deployment stuck / failing** — severity MEDIUM, contact Hasan
- **AlarmLow alarms firing** — this is NORMAL auto-scaling-down behaviour. Not an incident.
- **Side project ECS issues (inventory-ai, etc.)** — restart is allowed, excluding vlx-marketing-prod

### 7. OpenSearch Alerts
- **Dev cluster in YELLOW status** — this is normal, wait, it will recover on its own
- **Dev cluster in RED status** — also often self-recovers; wait before escalating
- **If it doesn't recover** — check the SQS queue and Lambda logs for clues first, then contact Nishant
- **Prod cluster issues** — contact Nishant; also check the queue and Lambda logs for context

### 8. ElastiCache / Redis (RCS) Alerts (Prod only)
- **Any RCS / ElastiCache issue** — contact Nishant
- **High memory usage** — severity HIGH, contact Nishant
- **Connection spike** — severity MEDIUM, contact Nishant

### 9. SQS Queue Alerts (Prod only)
- **Any SQS error** — failed messages automatically move to the DLQ (dead-letter queue); check the DLQ for message details
- **DLQ depth growing** — severity HIGH; messages can be redriven (resent) from DLQ back to the main SQS queue; contact Hasan to action
- **Oldest message age growing** — processing stalled; severity HIGH, contact Hasan

### 10. ALB / WAF Alerts (Prod only)
- **DO NOT make any changes to prod ALB or WAF rules** — even small changes can cause production outages. Read-only. Escalate to Hasan or Vivek.
- **High 5XX error rate (prod report or AI template)** — NO blue-green on these services. They will recover in a few minutes. Wait and monitor.
- **High 5XX error rate (main API or web)** — severity HIGH, contact Hasan
- **"4800ms" latency alert in uptime prod channel** — this is a timeout, NOT downtime. No action needed.
- **WAF blocking a request / report server blocked** — check with Jay and Hasan; severity MEDIUM; do not touch WAF rules yourself
- **Unhealthy host count > 0** — severity CRITICAL, contact Hasan

### 11. Bedrock (AI) Alerts
- **Requests from outside us-east-1 or us-east-2** — ignore completely, not relevant
- **Bedrock input token alarm (`Bedrock-input-token-17k`)** — keep an eye on it; values should stay in thousands; if it climbs into the hundreds of thousands (lacs), that is abnormal — check the Slack channel chart and contact Lakshya
- **Cost concern** — Bedrock has a hard $100/month cutoff enforced via Lambda; if cost-related alerts appear, contact Lakshya immediately
- **Any other Bedrock error** — contact Lakshya; he owns everything Bedrock-related

### 14. S3 Issues (Very rare)
- **Access errors / file not found** — check IAM permissions on the bucket; severity LOW unless prod-facing; contact Roshni

### 15. Lambda / MPI_SERVER Issues
- **Lambda errors** — first check the workflow/trigger that invoked the Lambda, then check the Lambda logs (CloudWatch Logs); you will almost always find the root cause there. Do NOT restart MPI_SERVER.
- **If cause is found but fix is unclear** — contact Vivek for anything major or complex
- **MPI_SERVER** — do not restart; it runs DB backup, Jira ticket enforce, and S3 file notification tools. Escalate to Vivek.

### 13. SSM Parameter Store & Pipeline Issues
- **Before adding or updating any SSM parameter** — double-check the name, environment, and value. A wrong parameter brings down ECS services. Verify twice before saving.
- **ECS service failing to start / crashing on deploy** — the most common cause is a missing SSM parameter. Check the ECS task logs for `parameter not found` errors, then verify the parameter exists in SSM Parameter Store for the correct environment (dev/QA/prod).
- **Pipeline fails** — check the pipeline logs first for a clear error. If no obvious error, restart the pipeline once. If it fails again, investigate further before escalating.
- **Android pipeline** — has Infisical integration. Any secret added directly to Android secrets will be **automatically deleted** because Infisical is the source of truth. Always add secrets to Infisical first, then they will sync to Android automatically.
- **Missing secret in Android** — check Infisical for the required secret before adding it anywhere else.


### 16. IAM / Permissions Issues
- **"Access Denied" error** — missing group membership; severity LOW, contact Roshni
- **New developer needs AWS access** — IAM groups: SDE, Sr_SDE, ReadOnly_Users, Infra_Code_Diagnosis_Develoeprs, CloudWatch_Read_Only; ask Roshni to assign

### 17. When in Doubt
- For anything major, complex, or unclear — call Vivek directly: **+91 6352266437**

### 18. Severity Reference Table
| Severity | Meaning | Response |
|----------|---------|---------|
| LOW | Non-urgent, no user impact | Email the contact |
| MEDIUM | Degraded experience, not down | Slack the contact |
| HIGH | Feature broken or at risk | Slack + call |
| CRITICAL | Production down or data at risk | Call Vivek (+91 6352266437) and Rushi S (CTO Promact) |

---

## Format Notes

- **Output:** Markdown file → paste into Confluence as-is (Confluence supports markdown import) or use as copy source
- **Tone:** Plain English, no jargon, no AWS console steps
- **Length:** Each alert entry = 3–5 lines max (what happened, why it matters, who to call)
- **Expandable sections:** Each service section can be a Confluence expand/accordion macro so the page isn't overwhelming
- **To be added later:** Vivek will specify additional scenario-specific entries after the base document is created
