<claude-mem-context>
# Memory Context

# [pf2e-tokener] recent context, 2026-05-07 1:55pm GMT+3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (18,096t read) | 291,973t work | 94% savings

### May 7, 2026
1339 11:36a 🟣 Separate Folder Paths Implemented in candidates.js
1340 " 🟣 Separate Folder Paths: custom-folders.js Updated to Parse, Store, and Serialize portraitPath/subjectPath
1341 " 🟣 Separate Folder Paths: Template Context and i18n Placeholders Added to Custom Folders Settings
1342 " 🟣 Separate Folder Paths: Settings UI Template Updated with Collapsible Advanced Art Folders Section
1343 11:37a 🟣 Separate Folder Paths: foundry-index.js Now Browses All Three Art Directories at Index Build Time
1344 " 🟣 Separate Folder Paths: i18n Keys and Advanced Section CSS Finalized
1345 " 🟣 Separate Folder Paths Feature: TDD GREEN — Test Passes
1346 " ✅ Separate Folder Paths Feature Documented in CHANGELOG and Formatted
1348 11:38a 🟣 Full Test Suite Passes After Both New Features: 97/97
1358 11:42a ✅ Drakkenheim Monsters Module Asset Path Configuration
1359 " 🔵 pf2e-tokener Custom Folders: Split Path Architecture for portraitPath/subjectPath
1360 " 🟣 pf2e-tokener v1.0.3 Release: Advanced Custom Folder Paths Shipped
1361 11:43a 🔵 Split-Path Candidate Resolution: Token Ring Integration and Scoring Logic
1362 " 🔵 Test 44 Failure: portraitPath Lost When subjectPath Omitted from Custom Folder Source
1363 " 🔴 candidates.js: portraitPath Now Doubles as subjectPath for Dynamic Token Ring When subjectPath Is Absent
1364 11:44a 🔵 Full Diff Scope: Split-Path Functions Are Net-New in This Session + Custom Tag Creation UI Added
1366 " ⚖️ Two-Folder Dynamic Token Fix Extracted into v1.0.4 Release
1368 " ✅ pf2e-tokener Bumped to v1.0.4 Across All Version Files
1383 11:55a 🟣 GM Custom Tag Support Extended to All Sources
S248 Change custom folders dialog to v2 and add option to add tags to it (May 7 at 12:08 PM)
1416 12:08p 🔵 pf2e-tokener picker and custom image tags dialog already use ApplicationV2/DialogV2
1417 " 🔵 pf2e-tokener has dual CSS targeting for both Token HUD and ApplicationV2 picker contexts
1418 12:09p 🟣 Added scroll position capture and restore to picker partial re-renders
1419 " 🟣 Scroll preservation wired into picker listener activation and custom image tags save path
1420 " 🟣 Test added for scroll preservation after custom image tags save
1421 " 🔵 Custom folders management dialog is a separate feature from the per-image tag editor
1422 12:10p 🟣 All 98 tests pass after scroll preservation and custom image tags changes
1423 " 🔵 Custom folders settings dialog already uses ApplicationV2 wrapper delegating to DialogV2
1424 " 🔵 CHANGELOG reveals custom folders DialogV2 and source-level tags were added in v1.0.3 (same day)
1425 " 🟣 New `scripts/image-tags.js` module created for global GM image tag overrides stored in world settings
1427 12:11p 🟣 Image tag overrides wired into the Foundry index build pipeline as a post-deduplication step
1428 " 🔴 foundry-index.js patch failed on first attempt due to import order mismatch
1431 " 🟣 Picker app migrated to global image tag overrides with read-only original tag protection in the edit dialog
1434 12:12p 🔵 picker-app.js migration patch failed — file still in old state; chip template format mismatch and duplicate name attribute found
1436 " 🟣 picker-app.js migration to global image tag overrides completed via incremental patches
1438 " ✅ Template, i18n, and CHANGELOG updated to reflect global image tag overrides feature
1441 " 🔵 Stale references to old `customImageTagsEditable`/`setCustomFolderImageTags` remain in candidates.js and tests
1442 12:13p ✅ Updated image tags dialog hint text to clarify GM overlay vs read-only source tags
1446 " 🔵 Remaining cleanup needed: candidates.js still sets `customImageTagsEditable`; test still calls `setCustomFolderImageTags`
1447 " 🟣 CSS added for disabled original tag chips and dimmed labels in image tag edit dialog
1448 12:14p 🔴 Hidden tag input for original tags now rendered with `disabled` attribute
1450 " 🔵 Prettier cannot format picker.hbs due to Handlebars block inside HTML attribute
1451 " 🟣 All 99 tests pass — GM image tag overrides feature complete and verified
1452 12:19p 🔄 Removed `customImageTagsEditable` from candidates.js and extended `preserveScroll` to tag filter interactions
1453 12:20p 🟣 Feature committed to git: "Add global GM image tag overrides for all token art sources"
1454 " ✅ pf2e-tokener bumped to version 1.0.5 with CHANGELOG restructured
1467 12:24p 🟣 Scroll preservation extended to also capture and restore `.pf2e-tokener-tag-groups` sidebar scroll
1484 1:52p 🔵 pf2e-tokener Results/Token Part Re-renders on Apply — Investigation Started
1485 1:53p 🔵 Root Cause Found: applyCandidateAction Unconditionally Re-renders Main Part After Apply
1486 " 🔴 Token Art Apply No Longer Resets Results Panel Scroll Position
1487 " 🔴 pf2e-tokener Fix Verified: 100/100 Tests Pass, Lint Clean

Access 292k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>