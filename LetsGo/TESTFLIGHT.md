# TestFlight (Lets Go)

1. Install EAS CLI and run `eas login`.
2. From the `LetsGo` app folder: `eas build --platform ios --profile preview`.
3. After the build finishes: `eas submit --platform ios --latest` (configure App Store Connect API key once).
4. In App Store Connect, enable **Internal Testing**, add testers by email, and share the TestFlight link.

Distribution certificate steps follow Apple’s “Certificates, Identifiers & Profiles” wizard; EAS can manage certs when you opt in during the first iOS build.
