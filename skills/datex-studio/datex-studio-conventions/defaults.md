# Defaults for New Components

When authoring a new component, these defaults apply unless the user specifies otherwise. All apply uniformly across component types (actions, functions, customTypes, datasources, footprint-datasources, selectors, hubs, grids, forms, editors, storage, etc.).

## Default Package: `Utilities`

When creating a new component file, **default to package `Utilities`**. The package drives `$types.<Package>`, `$flows.<Package>`, `$datasources.<Package>`, `$apis.<Package>`, and the selector `moduleId` field.

If the user signals a different target package (e.g. "this belongs in `Allocations`"), honor that. Otherwise proceed with `Utilities` — the platform's import step can retarget the package at import time, so there is no value in stopping to confirm. Do not infer the package from the feature folder name — feature folder names do not necessarily match package names; the default is `Utilities`, not the folder.

This rule applies to **new files only**. When modifying an existing component, the package is already fixed (by folder location and existing references) and does not need re-confirming.

## Default Access Modifier: `public`

Every component file carries an `accessModifier` (`public` or `private`). **Default to `public`** on any newly authored component. Do not stop to confirm per-component.

If the user explicitly asks for `private` (for a specific component, or as a standing preference for a batch of work), honor that. When modifying an existing component, leave its `accessModifier` alone unless the user asks to change it.

## Descriptions Are Mandatory

Every component file **must** have a non-null, non-empty top-level `description`. Keep descriptions ≤ 100 characters per the platform limit (see [file-format.md](file-format.md)). Both rules are enforced by the [post-edit-verification](../post-edit-verification/SKILL.md) skill — invoke it after writing or modifying a component file to surface violations for fix-up.

- **New components**: always include a description when creating. Do not leave `description` as `null`.
- **Modified components**: when modifying an existing file whose `description` is null or empty, **add** a ≤100-char description as part of the same edit. The post-edit-verification skill flags a missing description, so backfilling is mandatory rather than something to ask about. The user can still override the wording you choose like any other authored value.
