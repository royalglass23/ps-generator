# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Architects, designers, builders, developers, and homeowners preparing a glass balustrade or pool-barrier project for Royal Glass review.

## Product Purpose

The PS1 Application collects enough project, design, site-condition, supporting-document, and mandatory contact information for Royal Glass to begin reviewing the appropriate compliance and commercial pathway. The initial journey is designed to take about a minute, accepts explicit uncertainty, and does not imply that submission guarantees Royal Glass will issue a PS1.

## Positioning

The journey combines a customer-facing visual system selection with structured project and site evidence, then routes the submission to human Royal Glass review rather than automatically accepting an engineering engagement.

## Operating Context

Applicants may begin with incomplete information. They state what they need, provide the mandatory job address, select a project and Royal Glass system or “Not sure,” optionally describe locations and upload evidence, then provide mandatory contact details and submit the application for assessment.

The current production candidate runs directly in the Royal Glass WordPress site through the `[royal_glass_ps1]` shortcode. The WordPress-native implementation owns the public runtime, intake persistence, private uploads, and queued email delivery. The earlier Next.js application remains a visual and behavioural reference, not the current deployment path.

## Capabilities and Constraints

- Preserve the six-section quick journey, validation, draft saving, uploads, final security check, submission, and success states.
- Full name, mobile, email, and job address are mandatory. Project stage, locations, and supporting documents are optional.
- Estimated installation and site condition must support an explicit “Not sure” answer.
- Use Google Places address autocomplete when configured, with manual job-address entry as the fallback.
- A PS1 Application is a review request, not a PS1 order, accepted engagement, or promise to issue a PS1.
- “More Information Request” is the customer-facing term for Royal Glass follow-up; “Council/BCA RFI” is reserved for authority-issued documents.
- The System Catalogue must remain replaceable without redesigning the journey or changing existing application meaning.
- The eventual shortcode must not duplicate the WordPress site header or footer and must scope its CSS to avoid theme collisions.
- Production system images require Royal Glass approval. Prototype imagery may remain clearly illustrative until approved assets are supplied.

## Brand Commitments

The application must look native to the current Royal Glass website. The live website is the binding visual reference for the official logo, Kumbh Sans typography, teal palette, architectural imagery, restrained corner rounding, broad white surfaces, and direct professional voice.

## Evidence on Hand

- Product language: `CONTEXT.md`
- P1 journey boundaries: `docs/discovery/prototype-scope.md`
- Current browser surface: `wordpress-native/royal-glass-ps1-native/assets/app.js`
- Current styles: `wordpress-native/royal-glass-ps1-native/assets/app.css`
- Current runtime and persistence: `wordpress-native/royal-glass-ps1-native/includes/`
- Earlier behavioural reference: `web/src/app/application-form.tsx`
- Local illustrative project images: `web/public/assets/`
- Live visual authority: `https://www.royalglass.co.nz/`

No approved production System Catalogue imagery is recorded in this repository.

## Product Principles

- Make the application feel like a trusted continuation of Royal Glass, not a separate software product.
- Keep the task focused: brand the workflow without reproducing the surrounding WordPress navigation.
- Use plain language and reveal only the information needed for the current decision.
- Preserve applicant work and communicate save, upload, validation, and submission status clearly.
- Never imply technical approval or engagement before Royal Glass completes its human review.

## Accessibility & Inclusion

The complete journey must remain keyboard-operable, maintain visible focus and state indicators, meet WCAG AA colour contrast, respect reduced-motion preferences, and reflow cleanly for mobile use.
