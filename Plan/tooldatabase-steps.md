# Tool Database Implementation - Work Breakdown

## Overview
Split into 8 implementation phases. Each phase delivers testable functionality.

---

## Phase 1: Core Data Model & Storage

**Goal:** Define tool schema and create database service.

**Files to create:**
- `js/tooldb.js` - Core database module

**Tasks:**
- [x] Define TOOL_TYPES, GEOMETRY_TYPES, USAGE_TYPES, SURFACING_STYLES constants
- [x] Define MATERIALS preset list constant
- [x] Create empty database structure with version, lastUpdated, tools array
- [x] Implement `loadToolDatabase()` - load from localStorage or create default
- [x] Implement `saveToolDatabase(db)` - save to localStorage
- [x] Implement `createTool(data)` - add new tool with UUID
- [x] Implement `updateTool(id, data)` - update existing tool
- [x] Implement `deleteTool(id)` - remove tool from database
- [x] Implement `getTool(id)` - retrieve single tool
- [x] Implement `getAllTools()` - retrieve all tools
- [x] Add validation helpers: validateTool() and validateMaterialPreset()

**Deliverable:** Working database service with CRUD operations.

---

## Phase 2: Tool Database UI (List View)

**Goal:** Create tools.html with tool list and filtering.

**Files to create:**
- `tools.html` - Tool database page
- `js/tools.js` - Tool list logic

**Tasks:**
- [x] Create tools.html with navigation from existing pages
- [x] Create table/grid layout matching existing card/card-header styles
- [x] Add "Add Tool" button
- [x] Create tool list table with columns: Name, Diameter, Flutes, Tool Type, Geometry, Usage
- [x] Implement filtering dropdowns: Tool Type, Geometry, Usage
- [x] Implement empty state when no tools exist
- [x] Wire up to tooldb.js service

**Deliverable:** browsable tool list with filtering.

---

## Phase 3: Tool Editor Form

**Goal:** Create form to add/edit tools.

**Files to modify:**
- `js/tools.js` - add editor logic

**Tasks:**
- [x] Create modal or separate form section for tool editing
- [x] Add form fields: Name, Manufacturer, Tool Type (select), Geometry (select), Usage (select), Diameter, Flutes, Shank Diameter, Cutting Length, Overall Length, Units, Notes
- [x] Add conditional Surfacing Cutter Style field (shown only when toolType=surfacing)
- [x] Add "Save" and "Cancel" buttons
- [x] Implement form population for edit mode
- [x] Implement form validation UI
- [x] Wire up to tooldb.js CRUD functions

**Deliverable:** Working tool create/edit functionality.

---

## Phase 4: Material Preset Editor

**Goal:** Add per-tool material preset management.

**Files to modify:**
- `js/tools.js` - extend editor

**Tasks:**
- [x] Add material preset accordion/dropdown in editor
- [x] Create "Add Preset" button
- [x] Create preset form with: RPM, Feedrate, Plungerate, Depth Of Cut, Stepover, Chipload
- [x] Implement preset list display in editor
- [x] Add inline edit/delete for each preset
- [x] Wire up presets to tool.materials object

**Deliverable:** Per-tool material feeds/speeds presets.

---

## Phase 5: Integration with Feeds & Speeds Calculator

**Goal:** Add tool selector to index.html.

**Files to modify:**
- `index.html` - add tool selector UI
- `script.js` - integrate tool selection

**Tasks:**
- [x] Add tool selector dropdown above diameter input
- [x] Add "Clear Tool" button to reset selector
- [x] Populate tool selector from database
- [x] Add material preset selector (when tool has presets)
- [x] Auto-populate: diameter, flutes, rpm, feedrate, doc, chipload from selected preset
- [x] Allow manual override after auto-population

**Deliverable:** Calculator auto-fills from tool database.

---

## Phase 6: Integration with Surface G-Code Generator

**Goal:** Add surfacing tool selector to surface.html.

**Files to modify:**
- `surface.html` - add tool selector UI
- `surface.js` - integrate tool selection

**Tasks:**
- [x] Add tool selector dropdown above bit-diameter input
- [x] Add material preset selector
- [x] Filter to show only tools where toolType=surfacing
- [x] Auto-populate: bit-diameter, rpm, feedrate, stepover, depth-per-pass
- [x] Allow manual override after auto-population

**Deliverable:** Surfacing generator auto-fills from tool database.

---

## Phase 7: Import/Export Functions

**Goal:** Add backup, CSV, and Fusion 360 export capabilities.

**Files to modify:**
- `tools.html` - add export buttons
- `js/tools.js` - add export functions

**Tasks:**
- [x] Add "Export JSON Backup" button
- [x] Add "Import JSON Backup" button with file input
- [x] Add "Export CSV" button
- [x] Add "Export Fusion 360" button
- [x] Implement JSON export (full database)
- [x] Implement JSON import with validation
- [x] Implement CSV export (one row per tool/material)
- [x] Implement Fusion 360 export (.tools format)

**Deliverable:** Full import/export capability.

---

## Phase 8: Polish & Testing

**Goal:** Final refinements and validation.

**Tasks:**
- [x] Add duplicate tool action
- [x] Add delete confirmation
- [x] Add success/error notifications
- [x] Verify LocalStorage persistence across page reloads
- [ ] Test all filter combinations
- [ ] Test all export/import formats
- [ ] Mobile responsiveness check

**Deliverable:** Production-ready tool database module.
