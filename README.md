# ShowTools PDF Compressor

A browser-based PDF compression tool powered by Ghostscript WebAssembly. All processing happens client-side — no files are uploaded to any server.

## License

This tool is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

The AGPL-3.0 license applies to the PDF compression functionality, which uses Ghostscript compiled to WebAssembly. Ghostscript is developed and maintained by Artifex Software, Inc. and is licensed under AGPL-3.0.

### What this means

- You are free to use, modify, and distribute this code
- If you modify this code and make it available over a network, you must also make the source code available to users
- Any derivative works must also be licensed under AGPL-3.0

Full license text: https://www.gnu.org/licenses/agpl-3.0.html

## Dependencies

- **Ghostscript WASM** (`@okathira/ghostpdl-wasm`) — AGPL-3.0
  - Source: https://github.com/okathira-dev/ghostpdl-wasm
  - Loaded from: https://cdn.jsdelivr.net/npm/@okathira/ghostpdl-wasm/

- **Shared utilities** (`shared.js`, `shared.css`) — Proprietary (ShowTools)
  - These files are not part of the AGPL-licensed code and are used by other tools in the ShowTools suite

## How it works

1. User selects a PDF file
2. The file is loaded into the browser (never uploaded)
3. Ghostscript WASM is loaded in a Web Worker
4. The PDF is compressed using Ghostscript's `pdfwrite` device
5. The compressed PDF is offered for download

### Compression presets

| Preset | DPI | Use case |
|--------|-----|----------|
| Screen | 72 | Web viewing, email attachments |
| eBook | 150 | Reading on screens, good balance |
| Printer | 300 | High-quality printing |
| Prepress | 300 | Maximum quality, minimal compression |

## Building / Running

No build step required. These are static HTML/JS files.

1. Place `compress.html`, `compress-worker.js`, `shared.html`, and `shared.js` in the same directory
2. Serve via any static file server (or open directly in a browser)
3. An internet connection is required on first load to fetch the Ghostscript WASM (~15MB, cached afterwards)

## Files

- `compress.html` — Main page with UI
- `compress-worker.js` — Web Worker that runs Ghostscript WASM
