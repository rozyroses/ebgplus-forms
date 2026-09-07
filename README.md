# EBG+ Forms

Standalone application site for forms.ebgplus.app, using the existing Supabase form and submission services.

## September 2026 redesign

- Approved ink-and-blue EBG+ logo, white interface, and responsive editorial homepage.
- Searchable opportunities, live result count, clear empty states and load retry.
- Split application layout with completion progress and required/optional labels.
- Accessible status announcements, keyboard focus, sign-in autofill, and dedicated submission confirmation.
- Existing public configuration, form lookup, authentication, guest mode, and `submit_ebg_form` payload retained.

No dependencies or build step. GitHub Pages continues to inject the existing public Supabase key through its deployment workflow.

Validation: JavaScript syntax and mocked execution for filtering, escaped content, completion counts, submission payload, success, and retry after API failure. No authenticated browser session or production submission was used. The redesign branch does not deploy automatically; merging to main runs the existing Pages workflow.
