# PRODUCT REQUIREMENTS DOCUMENT

## SuperComponent Studio

Elementor Plugin — Real-Time, Schema-Driven Custom Component Runtime

Version: **1.0 — MVP (Real-Time Copy & Paste)**
Status: **Ready for Development**
Owner: **Supercraft Sdn Bhd**
Date: **June 2026**

---

# 1. Product Overview

## 1.1 Purpose
SuperComponent Studio is a WordPress plugin that enables custom HTML, CSS, and JavaScript components to become fully editable Elementor widgets — without writing a single line of PHP widget code.

The plugin acts as a real-time, schema-driven runtime engine. Instead of uploading zip files or managing a component library in the WordPress admin, a developer or designer pastes the component's **Schema (JSON)**, **HTML**, **CSS**, and **JS** directly into the Elementor widget's settings panel. The plugin instantly parses the schema and dynamically generates the corresponding sidebar controls in the Elementor editor, binding these controls to the component's variables in real time.

## 1.2 The Problem It Solves
Custom-coded components are powerful but static. Once written, every change — a colour, an image swap, a spacing tweak, an animation speed — requires editing raw code. This creates a dependency on developers for what should be designer-level changes.

Existing Elementor solutions do not address this. Native Elementor widgets require manual PHP control registration. Elementor's AI generates layouts from existing widgets but cannot turn arbitrary custom code into an editable component.

## 1.3 The Solution
SuperComponent Studio introduces a copy-and-paste interface inside the Elementor editor. 

**Core Loop**
1. User drags the **SuperComponent** widget onto the canvas.
2. In the widget's **Developer** settings, the user pastes the component's Schema (JSON), HTML, CSS, and JS.
3. The plugin instantly parses the JSON schema and dynamically registers Elementor sidebar controls (inputs, color pickers, sliders, repeaters, etc.).
4. The user edits the generated controls visually.
5. Values are bound to HTML/CSS/JS at render time in the preview and on the frontend.

## 1.4 What SuperComponent Studio Is Not
- It does not convert or parse arbitrary code. That is handled upstream (e.g. an AI tool or developer who writes the schema and code).
- It is not an AI tool itself. It is pure runtime infrastructure.
- It does not replace Elementor. It extends it for custom-coded components.

---

# 2. Component Code & Schema Input

A component's code is entered directly into the widget's settings panel in the Elementor editor. There are four main input fields under the **Developer** section:

1. **Schema (JSON)**: Defines the controls that will be dynamically generated.
2. **HTML Template**: The markup with variable placeholders.
3. **CSS**: The styles with CSS variable tokens.
4. **JavaScript**: The component's script (optional).

## 2.1 Schema (JSON) Specification
This JSON defines the controls that will appear in the Elementor sidebar.

### Top-Level Fields
- `id`: Unique slug identifier (string).
- `name`: Human-readable display name (string).
- `settings`: Array of control definitions (array, required).

### Control Types
Each object in the settings array defines one control in the Elementor sidebar panel.

- `text`: Single-line text input -> Elementor text control
- `textarea`: Multi-line text input -> Elementor textarea control
- `richtext`: WYSIWYG text with formatting -> Elementor WYSIWYG control
- `image`: Image picker -> Elementor media control
- `url`: URL input with optional target -> Elementor URL control
- `color`: Colour picker with alpha support -> Elementor color control
- `slider`: Numeric range slider with unit -> Elementor slider control
- `number`: Direct numeric input -> Elementor number control
- `select`: Dropdown with defined options -> Elementor select control
- `switcher`: Boolean toggle -> Elementor switcher control
- `repeater`: Variable-length list of sub-fields -> Elementor repeater control
- `dimensions`: Four-sided spacing control (top/right/bottom/left) -> Elementor dimensions control
- `typography`: Font family, size, weight, line-height group -> Elementor typography control

### Control Definition Fields
- `id` (string, required): Variable name used in template and CSS tokens.
- `type` (string, required): Control type from the list above.
- `label` (string, required): Label shown in the sidebar panel.
- `default` (any): Default value.
- `description` (string): Optional helper text.
- `tab` (string): Panel tab: `content` (default), `style`, or `advanced`.
- `section` (string): Collapsible section group label within the tab.
- `condition` (object): Show this control only when another control matches a value.
- `min` / `max` / `step` (number): For `slider` and `number`.
- `unit` (string): For `slider` (e.g. `px`, `%`, `rem`).
- `options` (array): For `select` (array of `{ "value": "x", "label": "Y" }`).
- `fields` (array): For `repeater` (array of control definitions).

---

# 3. Template Binding System

The plugin uses a lightweight token substitution system to bind Elementor control values into the component output.

## 3.1 HTML Binding
Variables are written as double-curly-brace tokens in the HTML Template. Substitution happens server-side in PHP.

```html
<!-- Simple text -->
<h2 class="hero-title">{{title}}</h2>

<!-- Image -->
<img src="{{hero_image.url}}" alt="{{hero_image.alt}}" width="{{hero_image.width}}">

<!-- URL -->
<a href="{{cta_url.url}}" target="{{cta_url.is_external ? '_blank' : '_self'}}">{{cta_label}}</a>

<!-- Conditional render -->
{{#show_badge}}<span class="badge">{{badge_text}}</span>{{/show_badge}}

<!-- Repeater loop -->
{{#photos}}
  <div class="photo-item">
    <img src="{{image.url}}" alt="{{alt}}">
    <p>{{caption}}</p>
  </div>
{{/photos}}
```

## 3.2 CSS Variable Binding
The plugin injects a scoped `<style>` block before the component HTML. CSS variables are namespaced per widget instance.

```css
/* Injected by plugin — scoped to this widget instance */
#supercomponent-a3f9b2 {
  --blur: 12px;
  --card-bg: rgba(255,255,255,0.1);
  --gap: 24px;
  --primary-color: #4F46E5;
  --title-size: 48px;
}
```

The pasted CSS can then reference these tokens:
```css
.glass-card {
  backdrop-filter: blur(var(--blur));
  background: var(--card-bg);
  gap: var(--gap);
}
```

## 3.3 JavaScript Runtime
When JavaScript is present, the plugin loads it after the component HTML. To support live updates in the Elementor editor, the component's JS can listen for the `supercomponent:update` custom event.

```javascript
(function() {
  function init(settings) {
    // Custom JS logic using settings
  }

  // Initial render
  document.addEventListener('DOMContentLoaded', function() {
    const el = document.currentScript.closest('[data-supercomponent]');
    const settings = JSON.parse(el.dataset.settings || '{}');
    init(settings);
  });

  // Editor live update hook
  window.addEventListener('supercomponent:update', function(e) {
    if (e.detail.instanceId === el.dataset.instanceId) {
      init(e.detail.settings);
    }
  });
})();
```

---

# 4. Plugin Architecture

## 4.1 High-Level Structure
```
supercomponent-studio/
├── supercomponent-studio.php   ← Plugin bootstrap
└── includes/
    └── class-supercomponent-widget.php  ← The dynamic Elementor widget
```

## 4.2 Data Storage
All component configurations (Schema JSON, HTML, CSS, JS) and their configured control values are stored directly within Elementor's standard post meta storage. No custom tables or external files are created.

## 4.3 Dynamic Control Registration
Since Elementor's `register_controls` runs at the class level during widget initialization, the widget will:
1. Register a **Developer Settings** section containing four text/code controls: `schema`, `html`, `css`, and `js`.
2. Retrieve the saved settings of the current widget instance.
3. Parse the `schema` JSON.
4. Dynamically register the custom controls defined in the schema under the appropriate tabs and sections.
5. In the editor, when the `schema` JSON is updated, the editor will refresh the widget's control panel so the new controls appear instantly.

---

# 5. Functional Requirements (MVP)

- **FR-01**: Plugin registers one Elementor widget: `SuperComponent_Widget`.
- **FR-02**: Widget provides code editor controls for Schema (JSON), HTML, CSS, and JS.
- **FR-03**: Widget dynamically parses the Schema JSON and registers the specified Elementor controls.
- **FR-04**: Supports all major Elementor control types (text, textarea, color, slider, switcher, repeater, etc.).
- **FR-05**: Renders HTML by replacing `{{variable}}` placeholders with control values.
- **FR-06**: Scopes CSS variables to the widget's unique instance ID (`#supercomponent-{id}`).
- **FR-07**: Runs JS on the frontend and triggers `supercomponent:update` in the editor on control changes.
- **FR-08**: Gracefully handles invalid or empty JSON schemas without breaking the Elementor editor.

---

# 6. Non-Functional Requirements

- **WordPress Compatibility**: WP 6.0+
- **Elementor Compatibility**: Elementor Free/Pro 3.15+
- **PHP Version**: PHP 7.4+
- **Performance**: Schema parsing and control registration must be lightweight and fast.
- **CSS Isolation**: All styles scoped using the widget instance ID to prevent global leakage.
- **Security**: Escaping and sanitizing outputs appropriately.
