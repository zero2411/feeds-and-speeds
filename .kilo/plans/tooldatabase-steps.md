# Tool Database Implementation - Work Breakdown

## Overview
Split into 8 implementation phases. Each phase delivers testable functionality.

---

## Phase 1: Core Data Model & Storage

**Goal:** Define tool schema and create database service.

**Files to create:**
- `js/tooldb.js` - Core database module

**Tasks:**
- [ ] Define TOOL_TYPES, GEOMETRY_TYPES, USAGE_TYPES, SURFACING_STYLES constants
- [ ] Define MATERIALS preset list constant
- [ ] Create empty database structure with version, lastUpdated, tools array
- [ ] Implement `loadToolDatabase()` - load from localStorage or create default
- [ ] Implement `saveToolDatabase(db)` - save to localStorage
- [ ] Implement `createTool(data)` - add new tool with UUID
- [ ] Implement `updateTool(id, data)` - update existing tool
- [ ] Implement `deleteTool(id)` - remove tool from database
- [ ] Implement `getTool(id)` - retrieve single tool
- [ ] Implement `getAllTools()` - retrieve all tools
- [ ] Add validation helpers: validateTool() and validateMaterialPreset()

**Deliverable:** Working database service with CRUD operations.

---

## Phase 2: Tool Database UI (List View)

**Goal:** Create tools.html with tool list and filtering.

**Files to create:**
- `tools.html` - Tool database page
- `js/tools.js` - Tool list logic

**Tasks:**
- [ ] Create tools.html with navigation from existing pages
- [ ] Create table/grid layout matching existing card/card-header styles
- [ ] Add "Add Tool" button
- [ ] Create tool list table with columns: Name, Diameter, Flutes, Tool Type, Geometry, Usage
- [ ] Implement filtering dropdowns: Tool Type, Geometry, Usage
- [ ] Implement empty state when no tools exist
- [ ] Wire up to tooldb.js service

**Deliverable:** browsable tool list with filtering.

---

## Phase 3: Tool Editor Form

**Goal:** Create form to add/edit tools.

**Files to modify:**
- `js/tools.js` - add editor logic

**Tasks:**
- [ ] Create modal or separate form section for tool editing
- [ ] Add form fields: Name, Manufacturer, Tool Type (select), Geometry (select), Usage (select), Diameter, Flutes, Shank Diameter, Cutting Length, Overall Length, Units, Notes
- [ ] Add conditional Surfacing Cutter Style field (shown only when toolType=surfacing)
- [ ] Add "Save" and "Cancel" buttons
- [ ] Implement form population for edit mode
- [ ] Implement form validation UI
- [ ] Wire up to tooldb.js CRUD functions

**Deliverable:** Working tool create/edit functionality.

---

## Phase 4: Material Preset Editor

**Goal:** Add per-tool material preset management.

**Files to modify:**
- `js/tools.js` - extend editor

**Tasks:**
- [ ] Add material preset accordion/dropdown in editor
- [ ] Create "Add Preset" button
- [ ] Create preset form with: RPM, Feedrate, Plungerate, Depth Of Cut, Stepover, Chipload
- [ ] Implement preset list display in editor
- [ ] Add inline edit/delete for each preset
- [ ] Wire up presets to tool.materials object

**Deliverable:** Per-tool material feeds/speeds presets.

---

## Phase 5: Integration with Feeds & Speeds Calculator

**Goal:** Add tool selector to index.html.

**Files to modify:**
- `index.html` - add tool selector UI
- `script.js` - integrate tool selection

**Tasks:**
- [ ] Add tool selector dropdown above diameter input
- [ ] Add "Clear Tool" button to reset selector
- [ ] Populate tool selector from database
- [ ] Add material preset selector (when tool has presets)
- [ ] Auto-populate: diameter, flutes, rpm, feedrate, doc, chipload from selected preset
- [ ] Allow manual override after auto-population

**Deliverable:** Calculator auto-fills from tool database.

---

## Phase 6: Integration with Surface G-Code Generator

**Goal:** Add surfacing tool selector to surface.html.

**Files to modify:**
- `surface.html` - add tool selector UI
- `surface.js` - integrate tool selection

**Tasks:**
- [ ] Add tool selector dropdown above bit-diameter input
- [ ] Add material preset selector
- [ ] Filter to show only tools where toolType=surfacing
- [ ] Auto-populate: bit-diameter, rpm, feedrate, stepover, depth-per-pass
- [ ] Allow manual override after auto-population

**Deliverable:** Surfacing generator auto-fills from tool database.

---

## Phase 7: Import/Export Functions

**Goal:** Add backup, CSV, and Fusion 360 export capabilities.

**Files to modify:**
- `tools.html` - add export buttons
- `js/tools.js` - add export functions

**Tasks:**
- [ ] Add "Export JSON Backup" button
- [ ] Add "Import JSON Backup" button with file input
- [ ] Add "Export CSV" button
- [ ] Add "Export Fusion 360" button
- [ ] Implement JSON export (full database)
- [ ] Implement JSON import with validation
- [ ] Implement CSV export (one row per tool/material)
- [ ] Implement Fusion 360 export (.tools format)

**Deliverable:** Full import/export capability.

---

## Phase 8: Polish & Testing

**Goal:** Final refinements and validation.

**Tasks:**
- [ ] Add duplicate tool action
- [ ] Add delete confirmation
- [ ] Add success/error notifications
- [ ] Verify LocalStorage persistence across page reloads
- [ ] Test all filter combinations
- [ ] Test all export/import formats
- [ ] Mobile responsiveness check

**Deliverable:** Production-ready tool database module.