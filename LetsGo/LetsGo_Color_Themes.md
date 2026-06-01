# Let's Go — Color Theme Palette Reference

## Dark Mode — "Revolut meets Uber"
> Deep navy backgrounds, electric teal accent, glass-morphism surfaces

```typescript
export const COLORS_DARK = {
  primary:        "#00D4AA",   // Electric teal — CTAs, active states, highlights
  primaryDark:    "#00A886",   // Pressed state for primary
  primaryLight:   "#33DDBB",   // Subtle teal tints, backgrounds

  background:     "#0A0E1A",   // Deep navy — all screen backgrounds
  surface:        "#131929",   // Card backgrounds, bottom sheets
  surface2:       "#1C2438",   // Elevated cards, input fields
  surface3:       "#243050",   // Highest elevation surfaces

  border:         "#1E2D45",   // All dividers and borders
  borderLight:    "#2A3D5C",   // Subtle borders on elevated surfaces

  accent:         "#FF6B35",   // Surge pricing, warnings, urgent actions
  accentLight:    "#FF8C5A",   // Lighter accent for badges

  success:        "#22C55E",   // Online status, completed trips
  successLight:   "#4ADE80",   // Success backgrounds

  error:          "#EF4444",   // Errors, SOS button, sign out
  errorLight:     "#F87171",   // Error backgrounds

  warning:        "#F59E0B",   // Driver pending, moderate alerts
  warningLight:   "#FCD34D",   // Warning backgrounds

  text:           "#FFFFFF",   // Primary text
  textSecondary:  "#8A94A6",   // Subtitles, labels, secondary info
  textMuted:      "#4A5568",   // Placeholders, disabled states, hints

  overlay:        "rgba(0, 0, 0, 0.60)",    // Modal backdrops
  overlayLight:   "rgba(0, 0, 0, 0.30)",    // Soft overlays on map
  transparent:    "transparent",
};
```

### Dark Mode Map Style (Google Maps JSON)
```typescript
export const MAP_STYLE_DARK = [
  { elementType: "geometry",            stylers: [{ color: "#0A0E1A" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#0A0E1A" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#8A94A6" }] },
  { featureType: "road",                elementType: "geometry",           stylers: [{ color: "#1C2438" }] },
  { featureType: "road",                elementType: "geometry.stroke",    stylers: [{ color: "#131929" }] },
  { featureType: "road.highway",        elementType: "geometry",           stylers: [{ color: "#243050" }] },
  { featureType: "road.highway",        elementType: "geometry.stroke",    stylers: [{ color: "#1C2438" }] },
  { featureType: "road.highway",        elementType: "labels.text.fill",   stylers: [{ color: "#FFFFFF" }] },
  { featureType: "poi.park",            elementType: "geometry",           stylers: [{ color: "#0D1520" }] },
  { featureType: "water",               elementType: "geometry",           stylers: [{ color: "#0D1A2D" }] },
  { featureType: "transit",             elementType: "geometry",           stylers: [{ color: "#131929" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#8A94A6" }] },
];
```

---

## Light Mode — "Stripe meets Apple"
> Crisp whites, deep charcoal text, refined teal accent — clean and exclusive

```typescript
export const COLORS_LIGHT = {
  primary:        "#00B894",   // Refined teal — CTAs, active states, highlights
  primaryDark:    "#009578",   // Pressed state for primary
  primaryLight:   "#00D4AA",   // Subtle teal tints, icon backgrounds

  background:     "#F8F9FC",   // Off-white — all screen backgrounds
  surface:        "#FFFFFF",   // Pure white — cards, sheets, modals
  surface2:       "#F0F2F8",   // Light grey — input fields, elevated cards
  surface3:       "#E8ECF5",   // Divider-level grey — highest contrast surface

  border:         "#E2E6F0",   // All dividers and borders
  borderLight:    "#EEF1F8",   // Subtle borders on white surfaces

  accent:         "#FF5722",   // Surge pricing, warnings, urgent actions
  accentLight:    "#FF7043",   // Lighter accent for badges

  success:        "#16A34A",   // Online status, completed trips
  successLight:   "#22C55E",   // Success backgrounds

  error:          "#DC2626",   // Errors, SOS button, sign out
  errorLight:     "#EF4444",   // Error backgrounds

  warning:        "#D97706",   // Driver pending, moderate alerts
  warningLight:   "#F59E0B",   // Warning backgrounds

  text:           "#0D1117",   // Near-black — primary text
  textSecondary:  "#5A6478",   // Subtitles, labels, secondary info
  textMuted:      "#9BA3B4",   // Placeholders, disabled states, hints

  overlay:        "rgba(13, 17, 23, 0.50)",   // Modal backdrops
  overlayLight:   "rgba(13, 17, 23, 0.20)",   // Soft overlays on map
  transparent:    "transparent",
};
```

### Light Mode Map Style (Google Maps JSON)
```typescript
export const MAP_STYLE_LIGHT = [
  { elementType: "geometry",            stylers: [{ color: "#F8F9FC" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#F8F9FC" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#5A6478" }] },
  { featureType: "road",                elementType: "geometry",           stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road",                elementType: "geometry.stroke",    stylers: [{ color: "#E2E6F0" }] },
  { featureType: "road.highway",        elementType: "geometry",           stylers: [{ color: "#E8ECF5" }] },
  { featureType: "road.highway",        elementType: "geometry.stroke",    stylers: [{ color: "#E2E6F0" }] },
  { featureType: "road.highway",        elementType: "labels.text.fill",   stylers: [{ color: "#0D1117" }] },
  { featureType: "poi.park",            elementType: "geometry",           stylers: [{ color: "#E8F5E8" }] },
  { featureType: "water",               elementType: "geometry",           stylers: [{ color: "#C8D8F0" }] },
  { featureType: "transit",             elementType: "geometry",           stylers: [{ color: "#F0F2F8" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#5A6478" }] },
];
```

---

## Side-by-Side Comparison

| Token            | Dark Mode     | Light Mode    | Usage                              |
|------------------|---------------|---------------|------------------------------------|
| `primary`        | `#00D4AA`     | `#00B894`     | CTAs, active tabs, highlights      |
| `primaryDark`    | `#00A886`     | `#009578`     | Pressed button state               |
| `primaryLight`   | `#33DDBB`     | `#00D4AA`     | Tinted backgrounds, subtle accents |
| `background`     | `#0A0E1A`     | `#F8F9FC`     | All screen backgrounds             |
| `surface`        | `#131929`     | `#FFFFFF`     | Cards, bottom sheets               |
| `surface2`       | `#1C2438`     | `#F0F2F8`     | Input fields, elevated cards       |
| `surface3`       | `#243050`     | `#E8ECF5`     | Highest elevation surfaces         |
| `border`         | `#1E2D45`     | `#E2E6F0`     | Dividers, input borders            |
| `borderLight`    | `#2A3D5C`     | `#EEF1F8`     | Subtle borders on surfaces         |
| `accent`         | `#FF6B35`     | `#FF5722`     | Surge, warnings, urgent            |
| `success`        | `#22C55E`     | `#16A34A`     | Online, completed, confirmed       |
| `error`          | `#EF4444`     | `#DC2626`     | Errors, SOS, destructive actions   |
| `warning`        | `#F59E0B`     | `#D97706`     | Pending states, caution            |
| `text`           | `#FFFFFF`     | `#0D1117`     | Primary body text                  |
| `textSecondary`  | `#8A94A6`     | `#5A6478`     | Labels, subtitles, meta info       |
| `textMuted`      | `#4A5568`     | `#9BA3B4`     | Placeholders, disabled, hints      |

---

## How to Switch Themes in `lib/constants.ts`

```typescript
// Change this one line to switch the entire app theme:
const THEME = "light"; // "dark" | "light"

export const COLORS = THEME === "dark" ? COLORS_DARK : COLORS_LIGHT;
export const MAP_STYLE = THEME === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
```

---

## Config Changes Required When Switching

### `app.config.js`
```js
// Dark mode
userInterfaceStyle: "dark",
splash: { backgroundColor: "#0A0E1A" }

// Light mode
userInterfaceStyle: "light",
splash: { backgroundColor: "#F8F9FC" }
```

### `.cursorrules`
```
// Dark mode
Design: Dark mode, #0A0E1A background, #00D4AA accent. Premium feel — Revolut meets Uber.

// Light mode
Design: Light mode, #F8F9FC background, #00B894 accent. Premium feel — Stripe meets Apple.
```

---

*Let's Go — Theme Reference v1.0*
*Dark: Revolut meets Uber | Light: Stripe meets Apple*
