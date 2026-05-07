<claude-mem-context>
# Memory Context

# [pf2e-tokener] recent context, 2026-05-07 8:35am GMT+3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 30 obs (11,205t read) | 370,255t work | 97% savings

### May 7, 2026
1204 7:57a 🔵 pf2e-tokener Module Structure Explored
1205 " 🔵 custom-folders.js Uses Legacy FormApplication API
1206 7:58a 🔵 picker-app.js ApplicationV2 Pattern Is the Migration Target for custom-folders
1207 " 🔵 DialogV2 Confirmed Available in This Foundry Installation
1208 " 🔵 DialogV2.input() Pattern with Handlebars Template and Form Callback
1209 7:59a 🔵 DialogV2 Extends ApplicationV2 in Foundry Core
1210 " 🔵 DialogV2 Internal Implementation — Critical Constraints for custom-folders Migration
1211 " 🟣 TDD Failing Tests Written for Dialog v2 Migration and Tag Support
1212 " 🔵 Jest Not Available in PATH — Dependencies Need npm install
1219 " ⚖️ Custom Folders Tags: Replace Free Text with Structured Tag Picker
1220 8:09a 🔵 Custom Folders Tag Picker Refactor: Codebase Exploration
1221 " 🟣 Custom Folders: TDD Tests for Structured Tag Picker UI
1222 8:10a 🔵 TDD Red Phase Confirmed: 2 Tests Fail, State Access Pattern Identified
1223 " ✅ foundry-index.js: Expose ensureIndex on Module API
1224 " 🟣 custom-folders.js: Structured Tag Picker Implementation
1225 8:11a 🔴 Handlebars Parent Scope: {{../../index}} Needed for Doubly-Nested Each
1226 " 🔵 custom-folders.js Fallback HTML Still Has Old Free-Text Tags Input
1227 " 🟣 Custom Folders: Fallback Renderer + CSS for Tag Picker UI
1228 " 🟣 All 90 Tests Pass: Structured Tag Picker Implementation Complete
1229 " 🟣 Structured Tag Picker: Full Verification Green
1230 8:12a 🔴 Handlebars Glimmer parser blocks on `{{#if}}` in attributes and `../` context traversal
1231 8:20a 🟣 TDD test added for improved custom folder tag selector styling
1232 " 🟣 Custom folder tag picker template restructured for improved styling
1233 8:21a 🟣 Custom folder dialog CSS overhauled for compact, readable tag picker UI
1234 " ✅ Custom folders migration complete — patch changelog increment requested
1235 8:25a 🔵 Pre-existing Glimmer SyntaxError in templates/picker.hbs blocks prettier --check
1236 " 🔵 pf2e-tokener version state and uncommitted changed files before patch bump
1237 " ✅ pf2e-tokener bumped to version 1.0.2 with CHANGELOG entry
1238 8:26a 🔵 rtk serves stale cached output for repeated file read commands
1239 " 🔵 picker.hbs tag facet `open` attribute backed by `tags.groups[].open` from prepareTagFilterView

Access 370k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>