# Strict E2E matrix — PS1 data retention and upload safety

| Requirement/threat | Journey | Expected result | Required |
|---|---|---|---|
| AC-01 / TM-01 | Upload supported PDF/JPG/PNG/DWG | Structural validation passes and staff message receives attachment | yes |
| AC-02 / TM-01 | Upload malicious but structurally valid authorized fixture | Staff endpoint/mail security behavior is observed and recorded; WordPress itself supplies no clean verdict | yes |
| AC-03 / TM-01 | Submit with optional files | Staff receives files; applicant confirmation receives none | yes |
| AC-04 / TM-02 | Guess/request stored path | No bytes or path disclosure | yes |
| AC-05 / TM-03 | Oversized, excess, spoofed, repeated uploads | Correct 4xx/429; no orphan file or unsafe record | yes |
| AC-06 / TM-04 | Anonymous/subscriber records outcome | 401/403 and no state change | yes |
| AC-07 / TM-04 | Administrator records outcomes | Valid transition; unaccepted requires phone-contact confirmation | yes |
| AC-08 / TM-06 | Confirm outcome, advance seven days, run cleanup | WordPress payload/reference/token, files, and outbox removed or scrubbed | yes |
| AC-09 / TM-06 | Keep submitted for 14 then 30 days | One escalation; WordPress Intake Copy removed/scrubbed at day 30 | yes |
| AC-10 / TM-07/08 | Inspect mailbox, device, URLs, logs, backups | Residual copies and controls are documented; no unnecessary secret/PII leakage | yes |

Strict release coverage: **0/10**. Unit and WordPress Playground checks are supporting evidence, not deployed zero-retry E2E evidence.
