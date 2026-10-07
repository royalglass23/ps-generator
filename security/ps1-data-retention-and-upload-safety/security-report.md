# Security report — PS1 data retention and upload safety

- Date: 2026-10-08
- Base: `5a21198a5c67cef1c11f002c11b2a3a06f4c9ede` plus uncommitted candidate
- Overall verdict: **FAIL**

## Outcome

The candidate implements the chosen workflow: uploads are optional; PDF/JPG/PNG/DWG files must pass extension, detected-MIME, size, and signature checks; files stay outside the public web root; staff review mail receives the files; applicant confirmation receives none; ServiceM8 remains staff-driven. The 7/14/30-day WordPress retention lifecycle and administrator-only outcome endpoint remain intact.

The release gate is FAIL because structurally valid content is emailed without a pre-delivery malware verdict. Reliance on Microsoft Defender on managed staff devices reduces endpoint risk but does not prevent a malicious file from reaching the mailbox, cannot be attested by this plugin, and does not cover mailbox retention. The user explicitly accepted this residual risk; acceptance does not make the control pass.

## Findings

| ID | Severity | Result | Evidence / remediation |
|---|---|---|---|
| RET-UP-001 | High | **FAIL — accepted risk** | Direct unscanned staff attachments. Add a verified pre-delivery scanner or controlled-retrieval gate for PASS. |
| RET-UP-002 | High evidence | BLOCKED | Strict deployed E2E is 0/10; managed Defender/mail behavior not captured. |
| RET-UP-003 | Medium | BLOCKED | Production private-storage isolation, SMTP behavior, and cron execution unverified. |
| RET-UP-004 | Medium | FAIL | Cleanup/mail/escalation failures lack actionable non-PII alerting. |
| RET-UP-005 | Medium privacy | FAIL/BLOCKED | WordPress retention works locally, but mailbox/downloaded/backups and privacy procedures are not governed here. |

## Requirement evidence

| Requirement | Result |
|---|---|
| Optional structural upload validation | PASS local unit/integration |
| Staff attachment / applicant no attachment | PASS local integration |
| No automatic ServiceM8 delivery | PASS source/contract |
| Administrator-only outcome | PASS local integration / BLOCKED deployed |
| 7/14/30-day WordPress retention | PASS local integration / BLOCKED operations |
| Private non-public storage | PASS local / BLOCKED deployed |
| Malware prevention before staff delivery | **FAIL** |
| Strict production-shaped E2E | BLOCKED (0/10) |

## OWASP / ASVS summary

Standards checked: OWASP Top 10:2021 and OWASP ASVS 4.0 Level 2.

- A01/V4 access control: local role boundary passes; deployed evidence blocked.
- A04/V10 insecure design/malicious code: **FAIL** due to accepted direct unscanned attachments.
- A05/V12 file/resource configuration: structural and private-storage controls pass locally; deployed isolation blocked.
- A09/V7 logging/monitoring: FAIL for missing actionable scheduled-job alerts.
- Privacy/IPP5/IPP9: WordPress minimisation/expiry exists; mail/provider/device retention remains accepted and operationally unresolved.

## NZ Privacy Act 2020 code-verifiable mapping

- IPP1/2/4/8/10/13: collection is applicant-supplied and purpose-bound; local validation/minimisation controls pass, subject to production verification.
- IPP3/6/7: privacy notice and operational access/correction handling are not proved in this feature evidence.
- IPP5: **FAIL/BLOCKED** because unscanned personal attachments reach mail/device boundaries and deployed access, encryption-at-rest, and endpoint controls are not evidenced.
- IPP9: WordPress 7/14/30-day deletion passes integration, while SMTP, mailbox, downloads, backups, and ServiceM8 retention remain outside that cleanup.
- IPP11/12: mail/provider and any overseas-processing safeguards require organisational/provider evidence.
- Breach readiness: insufficient job/cleanup monitoring prevents a complete code-side detection and scoping claim.

## Release decision

Do not describe this candidate as security-approved for public uploads. It matches the business decision and passes local functional verification, but Secure SDLC cannot recommend public deployment while RET-UP-001 is open and strict E2E is absent.
