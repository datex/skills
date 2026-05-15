# Deploy & Verify Patterns

## Assemble & Upload

Reports use a **folder-based workflow**. The report folder contains the RDLX-JSON layout, owned datasource configs, and a `manifest.json` with all binding metadata. The `assemble` command converts the folder into a wrapper JSON for upload.

```bash
# Assemble folder into wrapper JSON
dxs report assemble my-report/ -o my-report.json

# Upload wrapper to branch (idempotent by reference name)
dxs report upload my-report.json --branch <id>
```

Upload reads everything from the wrapper JSON — no `--name`, `--owned`, `--param`, or `--datasource-param` flags needed. All bindings are in the manifest.

### Managing Datasources in the Folder

```bash
# Add owned datasource (copies file into folder, updates manifest)
dxs report datasource add my-report/ --owned ds_data.json:ds_data \
  --param id:number \
  --datasource-param 'dataId=$report.inParams.id'

# Add external datasource (manifest-only, no file copied)
dxs report datasource add my-report/ --use-datasource ds_shared:shared

# List datasources in the folder
dxs report datasource list my-report/

# Remove datasource (deletes file if owned, updates manifest)
dxs report datasource remove my-report/ ds_old
```

### Multiple Datasources Sharing a Parameter

When several datasources share the same input parameter, pass `--datasource-param` on each `datasource add` call — each entry is scoped to that datasource's alias:

```bash
dxs report datasource add my-report/ --owned ds_header.json:ds_header \
  --param shipmentId:number \
  --datasource-param 'shipmentId=$report.inParams.shipmentId'

dxs report datasource add my-report/ --owned ds_lines.json:ds_lines \
  --param shipmentId:number \
  --datasource-param 'shipmentId=$report.inParams.shipmentId'
```

At assembly time, each alias-scoped binding is applied to its matching datasource.

### Dot-Notation for Cross-Datasource Params

Use `Alias.paramName=expression` to target a **different** datasource than the one being added:

```bash
# While adding ds_header, also bind ds_lines' shipmentId
dxs report datasource add my-report/ --owned ds_header.json:ds_header \
  --datasource-param 'shipmentId=$report.inParams.shipmentId' \
  --datasource-param 'ds_lines.shipmentId=$report.inParams.shipmentId'
```

The part before the dot is the target alias; the part after is the parameter name. Without dot-notation, the param scopes to the datasource being added.

### Access Modifier

Set `accessModifier` to `"private"` in `manifest.json` (default is `"public"`).

## Preview

```bash
dxs report preview my-report.rdlx-json
dxs report preview my-report.rdlx-json --data my-report.data.json -o preview.svg
dxs report preview my-report.rdlx-json --bbox Title:red --bbox LinesTable:blue -o /tmp/inspect.svg
```

SVG is the default and most reliable format. Use `--bbox NAME[:COLOR]` for visual debugging with colored bounding boxes.

## Verify

```bash
dxs report get <rep_reference> --branch <branch_id>
```

## Test Parameter Discovery

If the datasource has `in_params`, discover real test values and output them as JSON so the user can test in Studio:

```
Test parameters for **Warehouse: Tampa, Project: TemplateOwner, March 2026** (203 records):

{
  "WarehouseId": 1,
  "ProjectId": 500571,
  "FromDate": "2026-03-01T00:00:00.000Z",
  "ToDate": "2026-03-12T00:00:00.000Z"
}
```

Always include: parameter names matching `in_params` exactly, human-readable context, and ISO 8601 format for dates.

## Cleanup

After upload and verification, **ask the user** before removing local files. The user may want to keep the report folder for further modifications without re-downloading from the API.

> Upload complete. Would you like me to clean up the local files (`<folder>/` and the wrapper JSON), or keep them for further edits?

- If the user says **keep**: leave the report folder and any generated wrapper JSON in place.
- If the user says **clean up**: remove the wrapper JSON and the report folder.
- **Always** clean up temporary batch operation files (e.g., `*_ops*.json`) immediately after they are applied -- these are ephemeral and never needed again.

## Saving Artifacts

Save preview images for the record:

```bash
dxs report preview <report>.rdlx-json -o <artifact_dir>/<report-name>-preview.svg
```
