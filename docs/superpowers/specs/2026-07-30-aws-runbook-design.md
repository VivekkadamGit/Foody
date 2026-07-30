---
title: AWS Operations Runbook — Design Spec
date: 2026-07-30
status: approved
---

# AWS Operations Runbook — Design Spec

## Purpose

A Confluence document that lets developers understand what is happening when an AWS alert fires while the on-call infra person is on leave. Developers do not take action — they read, understand severity, and contact the right admin.

## Audience

Developers with limited AWS access. No remediation steps. Diagnose + escalate only.

## Escalation Contacts

| Name | Contact | Role |
|------|---------|------|
| Roshni | roshni@promactinfo.com | Infrastructure / RDS |
| Hasan | hasan@promactinfo.com | Application / ECS / EC2 |
| CM | CTO | Escalate if neither responds or prod is down |

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
- **Low free storage alarm fires** — what it means, which DBs have no auto-scale (risk), severity, contact Roshni
- **DB instance unavailable / connection refused** — severity CRITICAL, contact Roshni + CM
- **High CPU on RDS** — severity MEDIUM, contact Roshni

### 5. EC2 Alerts
- **Instance stopped unexpectedly** — prod = HIGH, dev/QA = MEDIUM, contact Hasan
- **High CPU (>80%)** — severity MEDIUM, contact Hasan
- **Note on intentionally stopped instances** — listed explicitly so devs don't panic

### 6. ECS (Containers) Alerts
- **Service task count drops to 0** — prod = CRITICAL, dev = HIGH, contact Hasan
- **Deployment stuck / failing** — severity MEDIUM, contact Hasan
- **AlarmLow alarms firing** — explain this is normal auto-scaling-down behaviour, not an incident

### 7. OpenSearch Alerts (Prod only)
- **Cluster status RED** — severity CRITICAL, contact Hasan
- **Low free storage** — severity HIGH, contact Hasan

### 8. ElastiCache / Redis Alerts (Prod only)
- **High memory usage** — severity HIGH, contact Hasan
- **Connection spike** — severity MEDIUM, contact Hasan

### 9. SQS Queue Alerts (Prod only)
- **Dead-letter queue depth growing** — means messages are failing; severity HIGH, contact Hasan
- **Oldest message age growing** — processing stalled; severity HIGH, contact Hasan

### 10. ALB / WAF Alerts (Prod only)
- **High 5XX error rate** — API or web returning errors; severity HIGH for prod, contact Hasan
- **WAF blocking spike** — possible attack or misconfigured rule; severity MEDIUM, contact Roshni
- **Unhealthy host count > 0** — load balancer can't reach instances; severity CRITICAL, contact Hasan

### 11. IAM / Permissions Issues
- **"Access Denied" error** — what it means (missing group membership), severity LOW, contact Roshni
- **New developer needs AWS access** — reference IAM groups (SDE, Sr_SDE, ReadOnly_Users, Infra_Code_Diagnosis_Develoeprs, CloudWatch_Read_Only, etc.) and ask Roshni to assign

### 12. Severity Reference Table
| Severity | Meaning | Response |
|----------|---------|---------|
| LOW | Non-urgent, no user impact | Email the contact |
| MEDIUM | Degraded experience, not down | Slack the contact |
| HIGH | Feature broken or at risk | Slack + call |
| CRITICAL | Production down or data at risk | Call CM immediately after Roshni/Hasan |

---

## Format Notes

- **Output:** Markdown file → paste into Confluence as-is (Confluence supports markdown import) or use as copy source
- **Tone:** Plain English, no jargon, no AWS console steps
- **Length:** Each alert entry = 3–5 lines max (what happened, why it matters, who to call)
- **Expandable sections:** Each service section can be a Confluence expand/accordion macro so the page isn't overwhelming
- **To be added later:** Vivek will specify additional scenario-specific entries after the base document is created
