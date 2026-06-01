# Twilio SMS — geo permissions (reference)

> **Note:** Driver onboarding **no longer uses SMS OTP** in this codebase. This file is kept as a **Twilio Console reference** if you add SMS elsewhere (notifications, ops, etc.).

## Error `21408` — “Permission to send an SMS has not been enabled for the region…”

Twilio blocks the send until your **account** allows SMS to that destination country.

### Fix (about two minutes)

1. Sign in to [Twilio Console](https://console.twilio.com/).
2. Go **Messaging** → **Settings** → **Geo permissions**  
   ([SMS Geo Permissions](https://www.twilio.com/docs/messaging/guides/sms-geo-permissions)).
3. Enable **SMS** for the destination country (e.g. **Australia** for `+61`), then **Save**.

Your **account address** and **sender number** country do **not** remove this step for international destinations.

## Other common blocks

| Code / symptom | What to do |
|----------------|------------|
| **21608** | Trial account: only **verified** destinations, or **upgrade** the account. |
| Invalid `From` / capability errors | Use a number with **SMS** enabled; optional: **Messaging Service** + `TWILIO_MESSAGING_SERVICE_SID`. |

## Secrets (if you deploy SMS from Edge)

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` (E.164) **or** `TWILIO_MESSAGING_SERVICE_SID`

Redeploy the Edge function that sends SMS after changing secrets or code.
