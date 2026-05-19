// ShowTools PDF Compressor - Web Worker (ES Module)
// Runs Ghostscript WASM off the main thread for responsive UI

const GS_CDN = 'https://cdn.jsdelivr.net/npm/@okathira/ghostpdl-wasm@0.1.3/dist/';
const GS_JS_URL = GS_CDN + 'gs.js';

let loadWASM = null;
let gsModule = null;
let cancelled = false;

async function initLoader() {
    if (loadWASM) return;

    try {
        const mod = await import(GS_JS_URL);
        loadWASM = mod.default;
    } catch (err) {
        throw new Error('Failed to load compression engine: ' + (err.message || 'Network error. Check your internet connection.'));
    }
}

async function getModule() {
    if (gsModule) return gsModule;

    await initLoader();

    const loadPromise = loadWASM({
        locateFile: (path) => GS_CDN + path,
        print: () => {},
        printErr: (text) => {
            if (text.toLowerCase().includes('error') && !text.toLowerCase().includes('warning')) {
                console.warn('GS:', text);
            }
        }
    });

    // Timeout after 60 seconds
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Compression engine timed out. The WASM file (15MB) may be too slow to download on your connection.')), 60000);
    });

    gsModule = await Promise.race([loadPromise, timeout]);
    return gsModule;
}

self.addEventListener('message', async function(e) {
    const { type, pdfBytes, preset, jobId } = e.data;

    if (type === 'compress') {
        cancelled = false;
        try {
            await compress(pdfBytes, preset, jobId);
        } catch (err) {
            if (cancelled) {
                self.postMessage({ type: 'cancelled', jobId });
            } else {
                self.postMessage({
                    type: 'error',
                    jobId,
                    message: err.message || 'An unknown error occurred during compression.'
                });
            }
        }
    } else if (type === 'cancel') {
        cancelled = true;
    }
});

async function compress(pdfBytes, preset, jobId) {
    const startTime = Date.now();
    const originalSize = pdfBytes.byteLength;

    self.postMessage({
        type: 'progress',
        jobId,
        status: 'loading',
        message: 'Loading compression engine (first time ~15MB download)...',
        progress: 0
    });

    await new Promise(r => setTimeout(r, 50));

    const Module = await getModule();

    if (cancelled) {
        self.postMessage({ type: 'cancelled', jobId });
        return;
    }

    self.postMessage({
        type: 'progress',
        jobId,
        status: 'compressing',
        message: 'Compressing PDF...',
        progress: 15
    });

    await new Promise(r => setTimeout(r, 50));

    // Clean virtual filesystem from previous runs
    try { Module.FS.unlink('input.pdf'); } catch {}
    try { Module.FS.unlink('output.pdf'); } catch {}

    // Write input file to virtual FS
    Module.FS.writeFile('input.pdf', new Uint8Array(pdfBytes));

    self.postMessage({
        type: 'progress',
        jobId,
        status: 'compressing',
        message: 'Optimizing pages and images...',
        progress: 30
    });

    await new Promise(r => setTimeout(r, 50));

    if (cancelled) {
        self.postMessage({ type: 'cancelled', jobId });
        return;
    }

    const args = getPresetArgs(preset);

    try {
        Module.callMain(args);
    } catch (err) {
        if (cancelled) {
            self.postMessage({ type: 'cancelled', jobId });
            return;
        }
        throw new Error('Compression failed. The PDF may be encrypted, corrupted, or too large for browser processing.');
    }

    self.postMessage({
        type: 'progress',
        jobId,
        status: 'compressing',
        message: 'Finalizing...',
        progress: 85
    });

    await new Promise(r => setTimeout(r, 50));

    if (cancelled) {
        self.postMessage({ type: 'cancelled', jobId });
        return;
    }

    let compressedBytes;
    try {
        compressedBytes = Module.FS.readFile('output.pdf');
    } catch {
        throw new Error('Compression failed — no output file was generated.');
    }

    // Clean up virtual filesystem
    try { Module.FS.unlink('input.pdf'); } catch {}
    try { Module.FS.unlink('output.pdf'); } catch {}

    self.postMessage({
        type: 'progress',
        jobId,
        status: 'compressing',
        message: 'Preparing download...',
        progress: 95
    });

    const compressedSize = compressedBytes.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    self.postMessage({
        type: 'complete',
        jobId,
        compressed: compressedBytes.buffer,
        originalSize,
        compressedSize,
        elapsed
    }, [compressedBytes.buffer]);
}

function getPresetArgs(preset) {
    const presets = {
        screen: [
            '-dPDFSETTINGS=/screen',
            '-dDownsampleColorImages=true',
            '-dColorImageResolution=72',
            '-dGrayImageResolution=72',
            '-dMonoImageResolution=300'
        ],
        ebook: [
            '-dPDFSETTINGS=/ebook',
            '-dDownsampleColorImages=true',
            '-dColorImageResolution=150',
            '-dGrayImageResolution=150',
            '-dMonoImageResolution=300'
        ],
        printer: [
            '-dPDFSETTINGS=/printer',
            '-dDownsampleColorImages=true',
            '-dColorImageResolution=300',
            '-dGrayImageResolution=300',
            '-dMonoImageResolution=1200'
        ],
        prepress: [
            '-dPDFSETTINGS=/prepress',
            '-dDownsampleColorImages=true',
            '-dColorImageResolution=300',
            '-dGrayImageResolution=300',
            '-dMonoImageResolution=1200',
            '-dPreserveEPSInfo=true',
            '-dPreserveOPIComments=true'
        ]
    };

    const base = [
        '-sDEVICE=pdfwrite',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-dCompatibilityLevel=1.4',
        '-sOutputFile=output.pdf',
        'input.pdf'
    ];

    return [...(presets[preset] || presets.ebook), ...base];
}
