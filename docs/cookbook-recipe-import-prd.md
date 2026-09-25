# Cookbook — Recipe Import PRD

**Status:** Draft

**Phase:** 3, following meal planning and grocery lists

**Date:** 2026-09-24

## Goal

Let a user add a recipe to Cookbook by pasting a recipe-page URL or uploading a screenshot, or by giving recipe text or a link to their connected chatbot. Cookbook extracts a usable recipe, shows an editable preview, and saves it only after the user confirms it. Imported recipes must work with existing serving scaling, meal plans, and grocery lists.

## User experience

1. From **Add recipe**, choose **Import from link** or **Import from image**.
2. Paste a URL or upload a screenshot and select **Preview recipe**.
3. Review and edit the title, servings, ingredient rows, instructions, and any available times or image.
4. Clearly mark missing or uncertain fields. Show the source link or uploaded image alongside the preview where practical.
5. Select **Save recipe**. The user can cancel without creating a recipe.

An import failure should explain what happened and leave the user able to enter the recipe manually.

**Chat example:** The user tells their MCP-connected chatbot, “Add this recipe,” and provides a link or pasted recipe text. The chatbot calls a Cookbook import-preview tool, shows the parsed recipe and any uncertain fields, then calls `create_recipe` on the user's explicit approval. A screenshot can use this flow when the chosen chatbot client can pass image content or an authenticated upload reference.

## MVP scope

| Area | Requirement |
| --- | --- |
| Link extraction | Fetch a public recipe page. Prefer embedded Schema.org `Recipe` data; use relevant visible page text when that data is absent or incomplete. |
| Screenshot extraction | Accept a common image format and send the screenshot directly to GPT-6 Luna for extraction. Support an image containing one recipe; multiple images and stitched pages are later work. |
| Normalization | Use GPT-6 Luna to map extracted content into Cookbook's existing recipe shape using structured output. Preserve each ingredient's original wording alongside quantity, unit, name, and preparation. |
| Review | Require explicit confirmation before saving. Make every extracted field editable; highlight missing servings, quantities, and instructions. Never invent an unreadable amount. |
| Save | Validate the edited draft with the same rules and create-recipe service used by manual entry and MCP. Record the source URL for link imports and the import method for both types. |
| Duplicates | Warn when the source URL or title resembles an existing recipe; let the user decide whether to continue. |
| MCP | Provide URL-to-draft and text-to-draft tools (or one import tool accepting either input). Return structured preview data; the chatbot shows it and saves through the existing authenticated recipe creation path after user approval. Screenshot import through MCP follows only when a chosen client can reliably pass image content or an authenticated upload reference. |

## Import pipeline

**URL:** validate URL → safely fetch page → extract recipe metadata/page text → Luna normalizes where needed → validate draft → user reviews → save.

**Screenshot:** validate image → Luna reads and normalizes image → validate draft → user reviews → save.

**Chat text:** accept supplied recipe text through authenticated MCP → Luna normalizes it → validate draft → chatbot presents review → user approves → `create_recipe` saves it.

Both routes produce the same `RecipeImportDraft` shape. Model output is untrusted data: validate types, lengths, ingredient structure, and required fields before displaying or saving. Keep page text out of tool instructions and do not allow the model to execute actions during import. A draft does not need a permanent database record for the first version; the UI can hold it until save, while MCP returns the draft to its caller.

## Guardrails

- The URL fetcher accepts public HTTP(S) recipe pages only. Block local, private, and metadata addresses, including after redirects; set response size and timeout limits.
- Limit upload size and allowed image types. Do not retain the original screenshot after import unless a later product decision explicitly adds source-image storage.
- Store the OpenAI API key on the server. Send only the recipe content or image needed for extraction.
- Treat servings and ingredient amounts as especially important: missing values remain blank for review. Do not let an unreviewed draft feed grocery calculations.
- Preserve source attribution for URLs. Show a useful error for blocked pages, missing recipe data, unreadable images, and model failures.

## Out of scope for the first release

Bulk imports, videos/social-media extraction, paywalled pages, browser automation for blocked sites, recipe rewriting, nutrition estimation, and automatic import into a meal plan. No vector database or local model deployment is needed.

## Acceptance criteria

1. A supported public recipe page imports with title, servings, ingredients, and ordered instructions in an editable preview.
2. A readable screenshot imports into the same preview using GPT-6 Luna image input.
3. An ambiguous or cropped amount is surfaced for review rather than silently guessed.
4. Saving an approved draft creates a normal Cookbook recipe usable in serving scaling and Phase 2 meal plans/grocery lists; cancelling creates nothing.
5. A blocked or unsuitable URL and an unreadable screenshot produce actionable errors without creating a recipe.
6. URL and pasted-text import are available through authenticated MCP preview tools. Given “add this recipe” and a link or pasted text, the chatbot presents the draft and saves it as the user after explicit approval.

## Delivery and effort

Build the shared draft/review/save flow first, then URL extraction, screenshot input, and MCP URL/text previews. This is a **moderate feature**, not a schema-only change: the main work is handling varied pages and uncertain ingredients. A rough planning estimate is **several development days for an MVP**, subject to the current code and how much of the recipe form/create service can be reused. Validate that estimate against the repository before committing to a schedule.

## Open implementation decisions

- Reuse the current recipe image workflow for imported page images, or leave image selection to the user in the MVP?
- Which MCP client will be used for image imports, and can it pass image content or authenticated upload references reliably?
