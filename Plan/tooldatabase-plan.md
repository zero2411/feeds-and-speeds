Hier is een volledig herschreven versie van het implementatieplan, met de verbeterde toolclassificatie geïntegreerd.

# CNC Tool Database - Implementation Plan

## Objective

Add a Tool Database module to the existing CNC Feeds & Speeds Calculator and Surface G-Code Generator.

The Tool Database will become the central source of tooling information for the entire application.

The system must:

* Store all tool data in JSON format.
* Persist data in LocalStorage.
* Support material-specific feeds & speeds presets.
* Automatically populate calculator fields from selected tools.
* Automatically populate surfacing generator fields from selected tools.
* Export tool libraries to:

  * Fusion 360 (.tools)
  * CSV (for Vectric VCarve import)
  * JSON backup
* Remain fully client-side with no backend requirements.

---

# High-Level Architecture

```text
Tool Database (JSON)
        │
        ├── Feeds & Speeds Calculator
        │
        ├── Surface Generator
        │
        ├── Fusion 360 Export
        │
        ├── CSV Export
        │
        └── JSON Backup
```

The Tool Database is the single source of truth.

All calculators and export functions must use the same dataset.

---

# Storage Strategy

Store the complete database as JSON.

Use LocalStorage for persistence.

Example:

```javascript
localStorage.setItem(
  "cnc-tool-database",
  JSON.stringify(toolDatabase)
);
```

Load:

```javascript
const toolDatabase =
  JSON.parse(
    localStorage.getItem("cnc-tool-database")
  ) || {
    version: 1,
    tools: []
  };
```

---

# Root JSON Structure

```json
{
  "version": 1,
  "lastUpdated": "2026-06-10T10:00:00Z",
  "tools": []
}
```

Field definitions:

| Field       | Description                |
| ----------- | -------------------------- |
| version     | Database schema version    |
| lastUpdated | ISO timestamp              |
| tools       | Array containing all tools |

---

# Tool Classification Model

Tools must be classified using multiple properties instead of creating separate tool types such as "Compression Bit" or "Upcut End Mill".

The model separates:

* Tool Type
* Geometry
* Usage Category

This provides better filtering and maps more closely to Fusion 360.

---

## Tool Types

Supported values:

```text
endmill
ballnose
vbit
surfacing
drill
engraving
```

Definitions:

| Tool Type | Description                 |
| --------- | --------------------------- |
| endmill   | Flat end mill               |
| ballnose  | Ball nose cutter            |
| vbit      | V carving cutter            |
| surfacing | Surfacing bit or fly cutter |
| drill     | Standard drill bit          |
| engraving | Engraving tool              |

---

## Geometry

Supported values:

```text
upcut
downcut
compression
straight
```

Definitions:

| Geometry    | Description                      |
| ----------- | -------------------------------- |
| upcut       | Pulls chips upward               |
| downcut     | Pushes chips downward            |
| compression | Combination of upcut and downcut |
| straight    | Straight cutting edges           |

Applicable primarily to woodworking tools.

---

## Usage Category

Supported values:

```text
general
roughing
finishing
```

Definitions:

| Usage     | Description         |
| --------- | ------------------- |
| general   | General purpose use |
| roughing  | Material removal    |
| finishing | Finish passes       |

---

## Surfacing Cutter Style

Only used when:

```text
toolType = surfacing
```

Supported values:

```text
insert
flycutter
```

Definitions:

| Style     | Description                 |
| --------- | --------------------------- |
| insert    | Replaceable carbide inserts |
| flycutter | Single-edge fly cutter      |

---

# Tool JSON Schema

Each tool must follow this structure:

```json
{
  "id": "tool_001",
  "name": "6mm Compression End Mill",
  "manufacturer": "Amana",

  "toolType": "endmill",
  "geometry": "compression",
  "usage": "general",

  "diameter": 6,
  "flutes": 2,

  "shankDiameter": 6,
  "cuttingLength": 25,
  "overallLength": 60,

  "units": "mm",

  "notes": "",

  "materials": {}
}
```

---

# Material Presets

Each tool may contain multiple material-specific feeds & speeds presets.

Structure:

```json
{
  "materials": {
    "MDF": {},
    "Plywood": {},
    "Hardwood": {}
  }
}
```

---

# Material Preset Schema

```json
{
  "rpm": 18000,
  "feedrate": 3500,
  "plungerate": 1000,
  "depthOfCut": 6,
  "stepover": 50,
  "chipload": 0.097
}
```

Field definitions:

| Field      | Description              |
| ---------- | ------------------------ |
| rpm        | Spindle speed            |
| feedrate   | Cutting feed rate        |
| plungerate | Z plunge feed            |
| depthOfCut | Recommended DOC          |
| stepover   | Recommended stepover (%) |
| chipload   | Chip load per tooth      |

---

# Example Tool

```json
{
  "id": "tool_001",
  "name": "6mm Compression End Mill",
  "manufacturer": "Amana",

  "toolType": "endmill",
  "geometry": "compression",
  "usage": "general",

  "diameter": 6,
  "flutes": 2,

  "shankDiameter": 6,
  "cuttingLength": 25,
  "overallLength": 60,

  "units": "mm",

  "materials": {
    "MDF": {
      "rpm": 18000,
      "feedrate": 3500,
      "plungerate": 1000,
      "depthOfCut": 6,
      "stepover": 50,
      "chipload": 0.097
    },

    "Plywood": {
      "rpm": 18000,
      "feedrate": 4000,
      "plungerate": 1200,
      "depthOfCut": 6,
      "stepover": 50,
      "chipload": 0.111
    }
  }
}
```

---

# Tool Database User Interface

Create:

```text
tools.html
tools.js
```

Add a navigation item:

```text
Tool Database
```

alongside:

```text
Feeds & Speeds
Surface Generator
```

---

# Tool List View

Display:

* Name
* Diameter
* Flutes
* Tool Type
* Geometry
* Usage

Actions:

* Add
* Edit
* Duplicate
* Delete

---

# Filtering

Support filtering by:

* Tool Type
* Geometry
* Usage

Examples:

* All End Mills
* All Compression Tools
* All Ball Nose Tools
* All Surfacing Cutters
* All Finishing Tools

---

# Tool Editor Form

Fields:

```text
Tool Name
Manufacturer

Tool Type
Geometry
Usage Category

Diameter
Flutes

Shank Diameter
Cutting Length
Overall Length

Notes
```

Conditional field:

```text
Surfacing Cutter Style
```

Visible only when:

```text
Tool Type = Surfacing
```

---

# Material Preset Editor

Allow multiple presets per tool.

Suggested material list:

```text
MDF
Particleboard
Plywood
Hardwood
Softwood
Acrylic
HDPE
PVC
Aluminium
Brass
```

Each material preset contains:

```text
RPM
Feedrate
Plungerate
Depth Of Cut
Stepover
Chipload
```

Add:

* Create Preset
* Edit Preset
* Delete Preset

---

# Integration With Feeds & Speeds Calculator

Add a Tool Selector above the existing diameter input.

Workflow:

1. Select Tool
2. Select Material
3. Calculator auto-populates values

Automatically populate:

```text
Diameter
Flutes
RPM
Feedrate
Depth Of Cut
Chipload
```

The user may still manually override values.

---

# Integration With Surface Generator

Add:

```text
Surfacing Tool Selector
```

Workflow:

1. Select Surfacing Tool
2. Select Material
3. Generator auto-populates fields

Populate:

```text
Bit Diameter
RPM
Feedrate
Stepover
Depth Per Pass
```

from the selected preset.

---

# Import / Export

## JSON Backup

Export the entire database.

Example:

```json
{
  "version": 1,
  "tools": []
}
```

Import must validate schema before saving.

---

## CSV Export

Generate one row per tool/material combination.

Example:

```csv
Tool,Diameter,Flutes,Material,RPM,Feedrate,DOC,Stepover
6mm Compression End Mill,6,2,MDF,18000,3500,6,50
```

---

## Fusion 360 Export

Create:

```javascript
exportFusionTools()
```

Initial support:

* End Mill
* Ball Nose
* V-Bit
* Surfacing Cutter

Map internal JSON properties to Fusion tool library properties.

---

# Validation Rules

Tool Validation:

```text
Name required
Unique tool name
Diameter > 0
Flutes >= 1
```

Material Validation:

```text
RPM > 0
Feedrate > 0
Plungerate > 0
Depth Of Cut > 0
Stepover between 1 and 100
Chipload > 0
```

---

# Future Extensions

Design the schema to remain compatible with:

* Direct Fusion import
* Direct Fusion export
* Direct Vectric .tooltdb export
* Cloud synchronization
* User accounts
* Tool images
* Tool vendors
* Tool wear tracking
* Automatic feeds & speeds generation
* Machine-specific tool libraries
* Shared community libraries

```
```
◊