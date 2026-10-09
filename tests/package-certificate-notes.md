# PMP training certificate sample

Base production: 02cccb8e1a5c5ec85c334b1250abfda80f6837ee.

Adds a labelled sample in the full PMP public detail page, after included content. Original AlSaeed purple/gold artwork has placeholder name/date, decorative trainer/provider signatures, gold sample seal and explicit training-completion wording. It is not a PMI-issued credential. No real student data, verification identifier, hours claim, or certificate issuance logic changes.

The SVG has outlined text, no external font/image dependencies, and an intrinsic 1600 × 1132 aspect ratio. The preview remains uncropped. A native modal provides enlargement, close/Escape and focus handling; browsers without native dialog support open the same image in a new tab. Page navigation removes the dialog. The existing hero video remains unchanged.

Validation: `node tests/package-certificate-dom.mjs`; optionally set CATALOG_FIXTURE to a read-only live catalog snapshot. Covers Arabic/English, all other packages, repeated open/close, route cleanup, focus, catalogue preservation and hero player. Native focus trapping/Escape and visual reflow are additionally verified in the preview browser before publication.
