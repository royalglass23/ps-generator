# Data classification — PS1 data retention and upload safety

| Data | Classification | WordPress retention | Additional copies / risk |
|---|---|---|---|
| Applicant and decision-maker contacts | Personal | Draft expiry; seven days after outcome; 30 days pending | Staff/applicant mail and ServiceM8 may retain copies separately. |
| Project address and answers | Personal/confidential | Same Intake Copy windows | Staff mail contains the review summary. |
| Optional PDF/JPG/PNG/DWG | Personal/confidential and untrusted | Private storage; same Intake Copy windows | Attached only to staff mail. No malware-clean verdict. Mailbox/downloaded copies are outside WordPress cleanup. |
| Draft bearer credential | Secret | SHA-256 hash; invalidated by submission/expiry | Plain token exists in applicant browser/resume link. |
| ServiceM8 reference | Internal | Removed on Intake Copy expiry | ServiceM8 remains authoritative. |
| Outcome/audit metadata | Internal | Minimal history policy still undefined | Includes staff actor ID, not applicant payload. |
| Mail outbox body | Personal/confidential | Purged with application; sent rows otherwise expire | SMTP/provider retention is operational. |
| Rate-limit key | Internal/pseudonymous | Deleted after expiry | Derived using a secret; raw IP need not be retained. |

Trust flow: browser -> WordPress private intake -> staff mail -> managed Windows endpoint/Defender; staff separately creates the ServiceM8 record. WordPress is not the durable record.
