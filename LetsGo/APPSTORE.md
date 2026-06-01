# App Store checklist (Lets Go)

## Export encryption compliance (fixes “Missing Compliance”)

Apple requires U.S. export compliance for apps that use encryption. Lets Go only uses **standard HTTPS/TLS** (Supabase, Stripe, maps, auth) through **Apple’s OS and standard libraries** — no custom or proprietary crypto.

**Permanent fix (already in `app.config.js`):**

```js
ios.config.usesNonExemptEncryption = false
```

(Expo sets `ITSAppUsesNonExemptEncryption` in Info.plist automatically.)

After the next **production iOS EAS build**, App Store Connect should read this from the binary and **not** show “Missing Compliance” on new builds.

**For build 3 already uploaded (one-time):**

1. App Store Connect → your app → **TestFlight** or **App Store** tab → build **3** → **Manage** (Missing Compliance).
2. Answer: **Does your app use encryption?** → **Yes** (HTTPS counts).
3. **Is it exempt?** → **Yes** — only standard encryption / exempt categories.
4. Or in the algorithm modal: **None of the algorithms mentioned above** (only OS/standard TLS, no proprietary crypto).
5. Save. Status should change from “Missing Compliance” to ready.

**App-level default (optional):** App Store Connect → **App Information** → **App Encryption Documentation** → set the same answers once for all future versions.

If you ever add **custom encryption** (proprietary algorithms, E2E chat crypto you built, VPN, etc.), remove `ITSAppUsesNonExemptEncryption: false` and complete Apple’s documentation flow.

---

- **Icon**: 1024×1024 PNG, no transparency, matching brand.
- **Screenshots**: Provide 6.7", 6.5", 5.5" iPhone sets per [Apple specs](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications).
- **Description**: Lead with safety + transparent pricing in Australia (AUD).
- **Keywords**: rideshare, taxi, transport, Australia, booking.
- **Privacy policy**: Public HTTPS URL required.
- **Category**: Travel.
