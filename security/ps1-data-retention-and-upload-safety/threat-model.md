# Threat model — PS1 data retention and upload safety

## Data flow

```text
Applicant -> WordPress REST -> structural validation -> private temporary storage
          -> staff review email with optional attachments -> managed staff device / Defender
          -> staff-only outcome -> 7/14/30-day WordPress cleanup
Applicant confirmation email -> no attachments
ServiceM8 -> staff-created record only; no automatic file transfer
```

## Material threats

| ID | Threat | Mitigation | Residual result |
|---|---|---|---|
| TM-01 | Malicious structurally valid file reaches staff | Allowlists, signature/MIME/size checks, private random storage, managed-device procedure | **FAIL/accepted:** no pre-delivery malware verdict; Defender acts only at/after staff endpoint. |
| TM-02 | Direct file disclosure | Storage outside webroot, denial files, basename-safe paths, no download route | Production filesystem/web-server isolation unverified. |
| TM-03 | Upload resource exhaustion | 10 MB/file, 25 MB total, five files, per-draft rate limit | Production concurrency/capacity untested. |
| TM-04 | Unauthorized staff outcome | `manage_options` permission callback | Role probes pass locally; deployed auth remains unverified. |
| TM-05 | Outcome repudiation | Transactional status history with staff actor/time | Operational audit retention undefined. |
| TM-06 | WordPress retains personal data | Seven-day outcome recovery; 14-day escalation; 30-day pending expiry; payload/token/reference scrub and upload/outbox deletion | Real cron, backups, and failure monitoring unproved. |
| TM-07 | Mailbox/device copy survives cleanup | WordPress deletes only its Intake Copy | **Accepted:** provider and downloaded copies are outside WordPress lifecycle. |
| TM-08 | PII leaks through logs/URLs/evidence | Hashed bearer tokens, random IDs, no applicant data in security evidence | Live logs, SMTP, backups, and ServiceM8 processing unverified. |
| TM-09 | Partial cleanup silently fails | File deletion precedes DB scrub; later job may retry | No actionable cleanup/cron health alert. |

## Judgment

The retention seam is sound locally. Direct unscanned delivery is a deliberate High-risk design choice, so public-release security sign-off is FAIL even though the implementation matches the accepted business decision.
