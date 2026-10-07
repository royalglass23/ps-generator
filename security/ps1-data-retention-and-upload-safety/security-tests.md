# Security test evidence — PS1 data retention and upload safety

## Executed on 2026-10-08

| Test | Result | Evidence |
|---|---|---|
| Native contract/unit suite | PASS | `npm.cmd test`: 36 passed; zero failed/skipped/todo. |
| JavaScript syntax | PASS | `npm.cmd run check:js`. |
| WordPress/PHP 8.1 Playground | PASS | CLI exited 0; schema/routes, direct staff attachment, attachment-free applicant queue, role authorization, and 7/14/30-day retention passed. |
| Outcome authorization | PASS integration | Anonymous 401/403; subscriber 403; administrator reached application-state validation. |
| Direct mail boundary | PASS integration | `submission_internal` carries upload ID; `submission_applicant` carries `[]`; dispatched staff mail resolves the private file. |
| ZIP/source parity | PASS | 47 expected files, 47 ZIP files, no missing/extra/mismatch; SHA-256 `6A025FF73B9C3A9F0F281DEA33C65796234A41BF4CE8E3C4D25BA04E7A6B5589`. |
| Local Windows Defender diagnostic | PASS diagnostic only | Current workstation reports antivirus, real-time protection, and network inspection enabled; signature `1.459.576.0`, updated 2026-10-06. This does not prove the staff mailbox/device fleet or provide a pre-delivery verdict. |
| npm dependency audit | N/A | Package declares no runtime or development dependencies and has no lockfile; `npm audit` cannot run without creating one. |
| Server malware scan | NOT PRESENT / FAIL gate | Deliberately removed; structural validation is not a malware verdict. |
| Managed Defender/mail behavior | BLOCKED | No production-like mailbox and managed-endpoint test was run. |
| Strict browser/API/cron/mail E2E | BLOCKED | No isolated deployed target, synthetic SMTP, deterministic time/cron, or report/traces. |

Playground emitted temporary-filesystem unlock warnings after assertions; exit code was 0.
