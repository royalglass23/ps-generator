# PS1 Application Portal

This context describes the language used to request, review and progress Royal Glass PS1 work without implying that submission guarantees a producer statement.

## Language

**PS1 Application**:
A request for Royal Glass to review project information and confirm the appropriate compliance and commercial pathway. Submission does not commit Royal Glass to issue a PS1 or begin paid work.
_Avoid_: PS1 order, confirmed PS1, automatic PS1 request

**Application Acknowledgement**:
The applicant's confirmation that the information supplied is accurate to the best of their knowledge and may be submitted for Royal Glass review. It is not approval of a fee or authority to begin paid engineering work.
_Avoid_: engagement acceptance, approval to proceed with engineering

**PS1 Engagement**:
The later agreement covering the confirmed scope, price and conditions for PS1 or engineering work. Where paid or custom work is required, Royal Glass obtains this approval after its initial technical review and before beginning that work.
_Status_: Provisional for the prototype; confirm the operational and legal process with Royal Glass before production.
_Avoid_: application acknowledgement, form submission

**More Information Request**:
A plain-language request from Royal Glass asking the applicant or project contact to provide information needed to continue reviewing the application. Customer-facing screens should explain what is missing and what happens next.
_Avoid_: RFI required, RFI received, unexplained RFI

**Council/BCA RFI**:
A formal Request for Information issued by a council or other Building Consent Authority. Use this term only when referring to that authority's document, not a Royal Glass follow-up request.
_Avoid_: using Council/BCA RFI as the name for a Royal Glass request

**Design Selection**:
The pictured balustrade or pool-barrier system the applicant is considering. The applicant may select "Not Sure" and provide a drawing, photograph, sketch or inspiration image for Royal Glass to review. This selection does not ask the applicant to classify the project as standard or specific design.
_Avoid_: customer-selected standard design, customer-selected specific design

**System Reference Image**:
An image that helps an applicant recognise a Royal Glass system when making a Design Selection. Production images must be approved Royal Glass system or project images. Clearly illustrative placeholders may be used only in the prototype.
_Avoid_: presenting a placeholder as an available or technically approved Royal Glass system

**System Catalogue**:
The maintained set of system categories and reference images offered for Design Selection. P1 uses Roxy's simple customer-facing categories, but the catalogue must be replaceable later without redesigning the application journey or changing the meaning of existing applications.
_Avoid_: hard-coded permanent system list, exposing the full technical PS Generator catalogue in P1

**PS1 Application Record**:
The authoritative business record of a reviewed PS1 Application in ServiceM8. An Accepted PS1 Application is represented by its Job Card; an Unaccepted PS1 Application is represented by a Non-job Outcome Record. WordPress does not remain the long-term system of record.
_Avoid_: WordPress application record, permanent submission copy

**Intake Copy**:
The temporary application data and supporting files held by WordPress while collecting, validating, and handing a PS1 Application to ServiceM8. It exists only to make intake and reliable handoff possible.
_Avoid_: archive, case file, permanent application

**Intake Recovery Window**:
The seven-day period after the corresponding ServiceM8 PS1 Application Record is confirmed. During this period, WordPress may retain the Intake Copy solely to recover from an incomplete transfer or operational error; when the window ends, the application data and uploaded files must be deleted.
_Avoid_: indefinite retention, permanent backup, seven business days

**Pending Review Window**:
The period in which WordPress may retain an Intake Copy that has not yet received a staff decision. The system escalates the application for staff attention after 14 calendar days and silently deletes the WordPress application data and uploaded files when they reach 30 calendar days, even if review remains incomplete. This automatic expiry does not notify the applicant.
_Avoid_: indefinite pending application, ServiceM8 retention period

**ServiceM8 Record Retention**:
The business retention policy for PS1 Application Records held in ServiceM8. These records do not automatically expire under the WordPress intake-retention rules.
_Avoid_: applying WordPress cleanup timers to ServiceM8 records

**Optional Supporting Upload**:
An applicant-supplied PDF, JPG, PNG, or DWG that is optional to the PS1 Application. WordPress validates its extension, detected MIME type, size, and file signature, keeps it outside the public web root, and attaches a structurally valid file directly to the staff review email. The applicant confirmation has no attachment. The plugin does not establish a malware-clean verdict; Royal Glass has accepted reliance on Microsoft Defender on managed staff devices.
_Avoid_: mandatory evidence, malware-cleared file, public media-library URL, applicant confirmation attachment

**Application Review**:
The Royal Glass staff decision on whether a submitted PS1 Application can proceed. Submission itself is not acceptance and does not create a ServiceM8 Job Card.
_Avoid_: automatic approval, applicant acceptance

**Accepted PS1 Application**:
A PS1 Application that Royal Glass staff has approved to proceed. Staff creates its ServiceM8 Job Card, and the applicant is later emailed the issued PS1.
_Avoid_: submitted application, automatically accepted application

**Unaccepted PS1 Application**:
A PS1 Application that Royal Glass staff has decided will not proceed. Royal Glass contacts the applicant by phone and records the outcome in ServiceM8 rather than issuing a PS1 or creating a ServiceM8 Job Card.
_Avoid_: failed submission, system rejection

**Non-job Outcome Record**:
The durable ServiceM8 activity or note recording that an Unaccepted PS1 Application will not proceed and that the applicant was contacted by phone. It is not a Job Card and must not imply that PS1 work was accepted.
_Avoid_: rejected Job Card, WordPress rejection archive

**Successful Application Handoff**:
The staff-controlled creation of a ServiceM8 Job Card for an Accepted PS1 Application. An automated submission email or mail-provider acceptance is only a review notification and does not complete the handoff.
_Avoid_: email sent, submission received, automatic Job Card creation
