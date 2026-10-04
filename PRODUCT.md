# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Architects, designers, builders, developers, and homeowners preparing a glass balustrade or pool-barrier project for Royal Glass review.

## Product Purpose

The PS1 Application collects the applicant, project, design, site-condition, and supporting-document information Royal Glass needs to review the appropriate compliance and commercial pathway. Success means an applicant can provide useful information confidently without interpreting submission as a guarantee that Royal Glass will issue a PS1.

## Positioning

The journey combines a customer-facing visual system selection with structured project and site evidence, then routes the submission to human Royal Glass review rather than automatically accepting an engineering engagement.

## Operating Context

Applicants may begin with incomplete drawings and return to a saved draft. They select a Royal Glass system or “Not sure,” identify installation conditions, upload drawings or photos, review their answers, and submit the application for assessment.

The production surface will ultimately be embedded in the Royal Glass WordPress site through a shortcode. The current Next.js application is the working visual and behavioural reference for that shortcode implementation.

## Capabilities and Constraints

- Preserve the existing six-step journey, validation, draft saving, uploads, security check, review, submission, and success states.
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
- Current working surface: `web/src/app/application-form.tsx`
- Current styles: `web/src/app/styles.css`
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
