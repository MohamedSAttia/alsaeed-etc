# V22 — Launch readiness and payments

## Payments

- Gateway selection now follows the value saved by the administrator without requiring a Railway redeploy.
- Open orders keep using the gateway recorded when they were created.
- Payment finalization is idempotent and updates the order and enrollment in one transaction.
- Disabled promo codes are rejected by the server.
- The admin settings page shows which Kashier, Paymob, Moyasar, and Tap integrations have their required keys and only allows selecting a configured gateway.

## Administration

- Added a protected platform-readiness endpoint.
- Added a readiness center to the main admin overview for payment configuration, question-language coverage, possible duplicate questions, Vimeo coverage, missing durations, and order status.
- Added a public health endpoint for deployment monitoring.

## Learner and checkout experience

- Added clear checkout trust indicators.
- Added accessible Terms, Privacy, and Refund summaries in the footer.
- Preserved the existing V19 video studio, automatic Vimeo duration lookup, lesson discussions, and V21 interface layer.

## Safety

- Possible duplicate questions are reported but are not deleted automatically.
- Kashier remains available until another configured gateway is selected and verified.
