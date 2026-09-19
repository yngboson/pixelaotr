/**
 * app.js - Controller for 2-Stage Pixel Sorting Simulator
 */

// DOM Elements
const sourceInput = document.getElementById('sourceInput');
const targetInput = document.getElementById('targetInput');
const sourceFileHint = document.getElementById('sourceFileHint');
const targetFileHint = document.getElementById('targetFileHint');
const fitModeSelect = document.getElementById('fitModeSelect');
const optMode5D = document.getElementById('optMode5D');
const optMode3D = document.getElementById('optMode3D');
const modeAuto = document.getElementById('modeAuto');
const modeManual = document.getElementById('modeManual');
const manualSliderRow = document.getElementById('manualSliderRow');
const manualMinStepSlider = document.getElementById('manualMinStepSlider');
const manualMinStepValue = document.getElementById('manualMinStepValue');

const btnPrepare = document.getElementById('btnPrepare');
const btnResetDefault = document.getElementById('btnResetDefault');
const btnLoadSample = document.getElementById('btnLoadSample');

const optimizerProgressContainer = document.getElementById('optimizerProgressContainer');
const optStatusTitle = document.getElementById('optStatusTitle');
const optPercentText = document.getElementById('optPercentText');
const optProgressBar = document.getElementById('optProgressBar');
const optDetailText = document.getElementById('optDetailText');

const sortAlgoSelect = document.getElementById('sortAlgoSelect');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnStep = document.getElementById('btnStep');
const btnReset = document.getElementById('btnReset');
const btnDownload = document.getElementById('btnDownload');
const btnExportGif = document.getElementById('btnExportGif');

const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const delaySlider = document.getElementById('delaySlider');
const delayValue = document.getElementById('delayValue');

const adaptiveSpeedCheck = document.getElementById('adaptiveSpeedCheck');
const adaptiveSliderRow = document.getElementById('adaptiveSliderRow');
const targetSpsSlider = document.getElementById('targetSpsSlider');
const targetSpsValue = document.getElementById('targetSpsValue');
const manualSpeedRow = document.getElementById('manualSpeedRow');

const mainCanvas = document.getElementById('mainCanvas');
const mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });
const mainMeta = document.getElementById('mainMeta');
const statusBar = document.getElementById('statusBar');

// Metric DOMs
const statResolution = document.getElementById('statResolution');
const statTotalPixels = document.getElementById('statTotalPixels');
const statTotalSwaps = document.getElementById('statTotalSwaps');
const statSortedPixels = document.getElementById('statSortedPixels');
const statCurrentAlgo = document.getElementById('statCurrentAlgo');
const statSimState = document.getElementById('statSimState');
const statSwapsPerSec = document.getElementById('statSwapsPerSec');
const statFps = document.getElementById('statFps');

// Global State
let sourcePixelsOriginal = null;
let targetPixelsTarget = null;
let destinationMap = null;
let imgWidth = 0;
let imgHeight = 0;

let defaultSourceFile = null;
let defaultTargetFile = null;
let defaultSrcImgElement = null;

let optimizer = null;
let isOptimizing = false;

let engine = null;
let isSorting = false;
let animationFrameId = null;

let mainImageData = null;
let mainData32 = null;

// Handle file input changes
sourceInput.addEventListener('change', () => {
    if (sourceInput.files && sourceInput.files[0]) {
        sourceFileHint.textContent = `Selected: ${sourceInput.files[0].name} (${(sourceInput.files[0].size / 1024).toFixed(1)} KB)`;
        sourceFileHint.style.color = '#008800';
    } else {
        sourceFileHint.textContent = 'Default Source: 10047C68-3563-44F7-9125-63DE531F3A86.png (Hamster V)';
        sourceFileHint.style.color = '#0055aa';
    }
});

targetInput.addEventListener('change', () => {
    if (targetInput.files && targetInput.files[0]) {
        targetFileHint.textContent = `Selected: ${targetInput.files[0].name} (${(targetInput.files[0].size / 1024).toFixed(1)} KB)`;
        targetFileHint.style.color = '#008800';
    } else {
        targetFileHint.textContent = 'Default Target: Site-background-dark.webp';
        targetFileHint.style.color = '#0055aa';
    }
});

btnResetDefault.addEventListener('click', () => {
    sourceInput.value = '';
    targetInput.value = '';
    loadDefaultProjectImages();
});

// Preload default project images (10047C68-3563-44F7-9125-63DE531F3A86.png & Site-background-dark.webp)
async function loadDefaultProjectImages() {
    try {
        logStatus('Loading default project images...');
        const [resSrc, resTgt] = await Promise.all([
            fetch('default_source.png'),
            fetch('default_target.webp')
        ]);

        if (!resSrc.ok || !resTgt.ok) {
            throw new Error(`HTTP Error: src=${resSrc.status}, tgt=${resTgt.status}`);
        }

        const blobSrc = await resSrc.blob();
        const blobTgt = await resTgt.blob();

        defaultSourceFile = new File([blobSrc], '10047C68-3563-44F7-9125-63DE531F3A86.png', { type: 'image/png' });
        defaultTargetFile = new File([blobTgt], 'Site-background-dark.webp', { type: 'image/webp' });

        defaultSrcImgElement = await loadImageElement('default_source.png');
        imgWidth = defaultSrcImgElement.naturalWidth || defaultSrcImgElement.width;
        imgHeight = defaultSrcImgElement.naturalHeight || defaultSrcImgElement.height;

        mainCanvas.width = imgWidth;
        mainCanvas.height = imgHeight;
        mainCtx.drawImage(defaultSrcImgElement, 0, 0, imgWidth, imgHeight);

        statResolution.textContent = `${imgWidth} x ${imgHeight}`;
        statTotalPixels.textContent = (imgWidth * imgHeight).toLocaleString();
        statTotalSwaps.textContent = '0';
        statSortedPixels.textContent = `0 / ${(imgWidth * imgHeight).toLocaleString()} (0.00%)`;
        statCurrentAlgo.textContent = sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text;
        statSimState.textContent = 'Default image ready';
        mainMeta.textContent = `Resolution: ${imgWidth}x${imgHeight} | Default image ready (Hamster V)`;

        sourceFileHint.textContent = `Default Source: 10047C68-3563-44F7-9125-63DE531F3A86.png (${imgWidth}x${imgHeight})`;
        sourceFileHint.style.color = '#0055aa';
        targetFileHint.textContent = `Default Target: Site-background-dark.webp`;
        targetFileHint.style.color = '#0055aa';

        logStatus(`Default image ready (${imgWidth}x${imgHeight}, ${(imgWidth * imgHeight).toLocaleString()} px). Select an optimization mode and click [Prepare & Optimize Intermediate Mapping].`);
    } catch (err) {
        console.warn('Failed to load default images:', err);
        logStatus('Default image auto-load waiting. You can also select custom images.');
    }
}

// Adaptive Speed Controller State
let targetSwapsPerSec = 240000; // Target 240,000 swaps/second (default)
let swapAccumulator = 0;
let lastFrameTime = performance.now();

let lastMetricTime = performance.now();
let swapsSinceLastMetric = 0;
let framesSinceLastMetric = 0;

// Adaptive Speed Mode Toggle
function updateAdaptiveSpeedUI() {
    if (adaptiveSpeedCheck.checked) {
        adaptiveSliderRow.style.display = 'flex';
        manualSpeedRow.style.display = 'none';
    } else {
        adaptiveSliderRow.style.display = 'none';
        manualSpeedRow.style.display = 'flex';
    }
}
adaptiveSpeedCheck.addEventListener('change', updateAdaptiveSpeedUI);

targetSpsSlider.addEventListener('input', () => {
    targetSwapsPerSec = parseInt(targetSpsSlider.value, 10);
    targetSpsValue.textContent = `${targetSwapsPerSec.toLocaleString()} swaps/s`;
});

// Radio buttons for min step mode
function updateMinStepModeUI() {
    if (optMode3D && optMode3D.checked) {
        modeAuto.disabled = true;
        modeManual.disabled = true;
        manualMinStepSlider.disabled = true;
        manualSliderRow.style.opacity = '0.4';
        manualMinStepValue.textContent = 'Auto Local-Minimum (No setup needed)';
    } else {
        modeAuto.disabled = false;
        modeManual.disabled = false;
        if (modeManual.checked) {
            manualMinStepSlider.disabled = false;
            manualSliderRow.style.opacity = '1.0';
            manualMinStepValue.textContent = `${parseInt(manualMinStepSlider.value, 10).toLocaleString()} steps`;
        } else {
            manualMinStepSlider.disabled = true;
            manualSliderRow.style.opacity = '0.5';
            manualMinStepValue.textContent = `${parseInt(manualMinStepSlider.value, 10).toLocaleString()} steps (Auto target)`;
        }
    }
}

if (optMode5D && optMode3D) {
    optMode5D.addEventListener('change', updateMinStepModeUI);
    optMode3D.addEventListener('change', updateMinStepModeUI);
}

modeAuto.addEventListener('change', updateMinStepModeUI);
modeManual.addEventListener('change', updateMinStepModeUI);
manualMinStepSlider.addEventListener('input', () => {
    manualMinStepValue.textContent = `${parseInt(manualMinStepSlider.value, 10).toLocaleString()} steps`;
});
updateMinStepModeUI();

// Speed slider mapping: log scale from 1 to 500,000
function getBatchSizeFromSlider(val) {
    const minVal = 1;
    const maxVal = 500000;
    const norm = (val - 1) / 99;
    return Math.max(1, Math.round(Math.pow(10, norm * Math.log10(maxVal))));
}

function updateSpeedLabel() {
    const batch = getBatchSizeFromSlider(parseInt(speedSlider.value, 10));
    speedValue.textContent = `${batch.toLocaleString()} / frame`;
}

function updateDelayLabel() {
    delayValue.textContent = `${delaySlider.value}ms`;
}

speedSlider.addEventListener('input', updateSpeedLabel);
delaySlider.addEventListener('input', updateDelayLabel);
updateSpeedLabel();
updateDelayLabel();
updateAdaptiveSpeedUI();

function logStatus(msg) {
    statusBar.textContent = `[Status] ${msg}`;
    console.log(`[Pixelator] ${msg}`);
}

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// Client-side fallback if backend API is not responding
async function processImagesClientSide(sourceFile, targetFile, fitMode) {
    const readUrl = (file) => new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target.result);
        reader.readAsDataURL(file);
    });

    const [srcUrl, tgtUrl] = await Promise.all([readUrl(sourceFile), readUrl(targetFile)]);
    const [srcImg, tgtImg] = await Promise.all([loadImageElement(srcUrl), loadImageElement(tgtUrl)]);

    const ws = srcImg.naturalWidth;
    const hs = srcImg.naturalHeight;
    const wt = tgtImg.naturalWidth;
    const ht = tgtImg.naturalHeight;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = ws;
    offCanvas.height = hs;
    const offCtx = offCanvas.getContext('2d');
    offCtx.fillStyle = '#000000';
    offCtx.fillRect(0, 0, ws, hs);

    const scale = fitMode === 'cover' 
        ? Math.max(ws / wt, hs / ht)
        : Math.min(ws / wt, hs / ht);

    const dw = wt * scale;
    const dh = ht * scale;
    const dx = (ws - dw) / 2;
    const dy = (hs - dh) / 2;

    offCtx.imageSmoothingEnabled = true;
    offCtx.imageSmoothingQuality = 'high';
    offCtx.drawImage(tgtImg, dx, dy, dw, dh);

    const finalTargetImg = await loadImageElement(offCanvas.toDataURL());
    return { srcImg, targetImg: finalTargetImg };
}

// ============================================================================
// Phase 1: Hill Climbing Intermediate Target Optimization
// ============================================================================

async function startHillClimbingOptimization(srcImg, tgtImg) {
    if (isSorting) pauseSorting();

    imgWidth = srcImg.naturalWidth || srcImg.width;
    imgHeight = srcImg.naturalHeight || srcImg.height;

    // Set canvas dimensions strictly to source dimensions (no resolution loss)
    mainCanvas.width = imgWidth;
    mainCanvas.height = imgHeight;

    // Extract source pixels
    const offCanvas = document.createElement('canvas');
    offCanvas.width = imgWidth;
    offCanvas.height = imgHeight;
    const offCtx = offCanvas.getContext('2d');

    offCtx.drawImage(srcImg, 0, 0, imgWidth, imgHeight);
    const srcData = offCtx.getImageData(0, 0, imgWidth, imgHeight);
    sourcePixelsOriginal = new Uint32Array(srcData.data.buffer.slice(0));

    // Extract target pixels (kept purely in memory, never shown to user)
    offCtx.clearRect(0, 0, imgWidth, imgHeight);
    offCtx.drawImage(tgtImg, 0, 0, imgWidth, imgHeight);
    const tgtData = offCtx.getImageData(0, 0, imgWidth, imgHeight);
    targetPixelsTarget = new Uint32Array(tgtData.data.buffer.slice(0));

    // Display original source image on main canvas
    mainCtx.drawImage(srcImg, 0, 0, imgWidth, imgHeight);
    mainImageData = mainCtx.getImageData(0, 0, imgWidth, imgHeight);
    mainData32 = new Uint32Array(mainImageData.data.buffer);

    // Update UI Stats
    statResolution.textContent = `${imgWidth} x ${imgHeight}`;
    statTotalPixels.textContent = (imgWidth * imgHeight).toLocaleString();
    statTotalSwaps.textContent = '0';
    statSortedPixels.textContent = '0 / ' + (imgWidth * imgHeight).toLocaleString();
    statCurrentAlgo.textContent = sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text;
    statSimState.textContent = 'Optimizing intermediate image...';
    mainMeta.textContent = `Resolution: ${imgWidth}x${imgHeight} | Original source image waiting`;

    // Initialize Hill Climbing Optimizer
    const isAuto = modeAuto.checked;
    const manualSteps = parseInt(manualMinStepSlider.value, 10);
    optimizer = new HillClimbingOptimizer(imgWidth, imgHeight, sourcePixelsOriginal, targetPixelsTarget, {
        isAutoMinSteps: isAuto,
        manualMinSteps: manualSteps
    });

    // Show Progress UI
    optimizerProgressContainer.style.display = 'block';
    optStatusTitle.textContent = `Generating intermediate image (${isAuto ? 'Auto min steps: ' + optimizer.minSteps.toLocaleString() : 'Manual min steps: ' + manualSteps.toLocaleString()})`;
    optProgressBar.value = 0;
    optPercentText.textContent = '0%';
    optDetailText.textContent = `Preparing... Initial error: ${optimizer.initialDistance.toFixed(2)}`;

    btnPrepare.disabled = true;
    btnLoadSample.disabled = true;
    btnPlayPause.disabled = true;
    btnStep.disabled = true;
    btnReset.disabled = true;
    btnDownload.disabled = true;
    btnExportGif.disabled = true;

    isOptimizing = true;
    logStatus(`Phase 1: Starting optimization (min steps: ${optimizer.minSteps.toLocaleString()})...`);

    // Async chunk loop for hill climbing
    const chunkSize = 40000;
    function optimizationLoop() {
        if (!isOptimizing) return;

        const isDone = optimizer.runChunk(chunkSize);

        // Update progress bar
        const progressRatio = Math.min(1.0, optimizer.stepsDone / optimizer.minSteps);
        const percent = Math.round(progressRatio * 100);
        optProgressBar.value = percent;

        if (optimizer.stepsDone < optimizer.minSteps) {
            optPercentText.textContent = `${percent}% (Ensuring min steps)`;
        } else {
            optPercentText.textContent = `100% (Converging)`;
        }

        optDetailText.textContent = `Steps: ${optimizer.stepsDone.toLocaleString()} / ${optimizer.minSteps.toLocaleString()} | Swaps: ${optimizer.totalSwaps.toLocaleString()} | Error: ${optimizer.currentDistance.toFixed(2)}`;

        if (isDone) {
            // Optimization finished
            isOptimizing = false;
            destinationMap = optimizer.getDestinationMap();

            optStatusTitle.textContent = `Intermediate image complete! (Final error: ${optimizer.currentDistance.toFixed(2)})`;
            optProgressBar.value = 100;
            optPercentText.textContent = '100% Complete';

            initSortingEngine();

            btnPrepare.disabled = false;
            btnLoadSample.disabled = false;
            btnPlayPause.disabled = false;
            btnStep.disabled = false;
            btnReset.disabled = false;
            btnDownload.disabled = false;
            btnExportGif.disabled = false;

            statSimState.textContent = 'Ready to sort';
            logStatus(`Intermediate image complete! Select an algorithm and click [Start Sorting].`);
        } else {
            // Schedule next chunk
            setTimeout(optimizationLoop, 0);
        }
    }

    setTimeout(optimizationLoop, 10);
}

// Prepare image click handler with GPU Acceleration
btnPrepare.addEventListener('click', async () => {
    const srcFile = (sourceInput.files && sourceInput.files[0]) ? sourceInput.files[0] : defaultSourceFile;
    const tgtFile = (targetInput.files && targetInput.files[0]) ? targetInput.files[0] : defaultTargetFile;

    if (!srcFile || !tgtFile) {
        alert('Please select source and target images, or wait for default images to load.');
        return;
    }

    const fitMode = fitModeSelect.value;
    const isAuto = modeAuto.checked;
    const minSteps = parseInt(manualMinStepSlider.value, 10);
    const optMode = (optMode3D && optMode3D.checked) ? '3d_rgb_vector' : '5d_sliced';
    const optModeName = optMode === '3d_rgb_vector' ? '3D RGB Vector Matching' : '5D Spatiotemporal Transport';

    optimizerProgressContainer.style.display = 'block';
    optStatusTitle.textContent = `GPU [${optModeName}] computing...`;
    optProgressBar.value = 30;
    optPercentText.textContent = 'GPU computing...';
    optDetailText.textContent = `Computing [${optModeName}] optimization via GPU.`;

    btnPrepare.disabled = true;
    btnResetDefault.disabled = true;
    btnLoadSample.disabled = true;
    btnPlayPause.disabled = true;
    btnStep.disabled = true;
    btnReset.disabled = true;
    btnDownload.disabled = true;
    btnExportGif.disabled = true;

    logStatus(`Uploading images to server; starting GPU [${optModeName}] optimization...`);

    const formData = new FormData();
    formData.append('source', srcFile);
    formData.append('target', tgtFile);
    formData.append('fit_mode', fitMode);
    formData.append('is_auto', isAuto ? 'true' : 'false');
    formData.append('min_steps', minSteps.toString());
    formData.append('opt_mode', optMode);

    try {
        const response = await fetch('/api/optimize-gpu', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            const srcImg = await loadImageElement(data.source_data_url);

            imgWidth = data.width;
            imgHeight = data.height;

            mainCanvas.width = imgWidth;
            mainCanvas.height = imgHeight;

            mainCtx.drawImage(srcImg, 0, 0, imgWidth, imgHeight);
            mainImageData = mainCtx.getImageData(0, 0, imgWidth, imgHeight);
            mainData32 = new Uint32Array(mainImageData.data.buffer);
            sourcePixelsOriginal = new Uint32Array(mainData32.slice(0));

            destinationMap = new Int32Array(data.destination_map);

            optProgressBar.value = 100;
            optPercentText.textContent = '100% Complete (GPU accelerated)';
            optStatusTitle.textContent = data.stats.message || `GPU accelerated [${optModeName}] Intermediate image complete!`;
            optDetailText.textContent = `Mode: ${optModeName} | Res: ${imgWidth}x${imgHeight} | Elapsed: ${data.stats.elapsed_seconds}s | Device: ${data.stats.device_name}`;

            statResolution.textContent = `${imgWidth} x ${imgHeight}`;
            statTotalPixels.textContent = (imgWidth * imgHeight).toLocaleString();
            statTotalSwaps.textContent = '0';
            statSortedPixels.textContent = `0 / ${(imgWidth * imgHeight).toLocaleString()} (0.00%)`;
            statCurrentAlgo.textContent = sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text;
            statSimState.textContent = 'Ready to sort';

            initSortingEngine();

            btnPrepare.disabled = false;
            btnResetDefault.disabled = false;
            btnLoadSample.disabled = false;
            btnPlayPause.disabled = false;
            btnStep.disabled = false;
            btnReset.disabled = false;
            btnDownload.disabled = false;
            btnExportGif.disabled = false;

            logStatus(`${data.stats.message || 'GPU optimization complete!'} Click [Start Sorting] to begin.`);
            return;
        } else {
            throw new Error(`Server returned status ${response.status}`);
        }
    } catch (err) {
        console.warn('Backend GPU API failed or offline, falling back to local pipeline:', err);
        logStatus('Server GPU API unavailable; falling back to client-side optimization...');
        const { srcImg, targetImg } = await processImagesClientSide(srcFile, tgtFile, fitMode);
        await startHillClimbingOptimization(srcImg, targetImg);
    }
});

// Built-in test sample button with GPU Acceleration
btnLoadSample.addEventListener('click', async () => {
    const w = 240;
    const h = 240;

    // 1. Colorful circular gradient source image
    const c1 = document.createElement('canvas');
    c1.width = w;
    c1.height = h;
    const ctx1 = c1.getContext('2d');
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const angle = Math.atan2(y - h/2, x - w/2);
            const dist = Math.hypot(x - w/2, y - h/2) / (w/2);
            const hue = ((angle + Math.PI) / (2 * Math.PI)) * 360;
            const sat = Math.min(100, Math.floor(dist * 100));
            ctx1.fillStyle = `hsl(${hue}, ${sat}%, 50%)`;
            ctx1.fillRect(x, y, 1, 1);
        }
    }

    // 2. Checkerboard with geometric target shape
    const c2 = document.createElement('canvas');
    c2.width = w;
    c2.height = h;
    const ctx2 = c2.getContext('2d');
    ctx2.fillStyle = '#0f172a';
    ctx2.fillRect(0, 0, w, h);

    const tileSize = 30;
    for (let y = 0; y < h; y += tileSize) {
        for (let x = 0; x < w; x += tileSize) {
            if ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0) {
                ctx2.fillStyle = '#fbbf24';
                ctx2.fillRect(x, y, tileSize, tileSize);
            }
        }
    }
    ctx2.fillStyle = '#ef4444';
    ctx2.beginPath();
    ctx2.arc(w/2, h/2, 65, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.fillStyle = '#3b82f6';
    ctx2.beginPath();
    ctx2.arc(w/2, h/2, 35, 0, Math.PI * 2);
    ctx2.fill();

    // Convert canvases to Blob and send to /api/optimize-gpu
    optimizerProgressContainer.style.display = 'block';
    optStatusTitle.textContent = 'Built-in sample: GPU computing...';
    optProgressBar.value = 40;
    optPercentText.textContent = 'GPU computing...';

    const blob1 = await new Promise(res => c1.toBlob(res, 'image/png'));
    const blob2 = await new Promise(res => c2.toBlob(res, 'image/png'));

    const optMode = (optMode3D && optMode3D.checked) ? '3d_rgb_vector' : '5d_sliced';
    const optModeName = optMode === '3d_rgb_vector' ? '3D RGB Vector Matching' : '5D Spatiotemporal Transport';

    const formData = new FormData();
    formData.append('source', blob1, 'sample_src.png');
    formData.append('target', blob2, 'sample_tgt.png');
    formData.append('fit_mode', 'cover');
    formData.append('is_auto', modeAuto.checked ? 'true' : 'false');
    formData.append('min_steps', manualMinStepSlider.value);
    formData.append('opt_mode', optMode);

    try {
        const response = await fetch('/api/optimize-gpu', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            const srcImg = await loadImageElement(c1.toDataURL());

            imgWidth = data.width;
            imgHeight = data.height;

            mainCanvas.width = imgWidth;
            mainCanvas.height = imgHeight;

            mainCtx.drawImage(srcImg, 0, 0, imgWidth, imgHeight);
            mainImageData = mainCtx.getImageData(0, 0, imgWidth, imgHeight);
            mainData32 = new Uint32Array(mainImageData.data.buffer);
            sourcePixelsOriginal = new Uint32Array(mainData32.slice(0));

            destinationMap = new Int32Array(data.destination_map);

            optProgressBar.value = 100;
            optPercentText.textContent = '100% Complete (GPU accelerated)';
            optStatusTitle.textContent = data.stats.message || 'GPU accelerated Intermediate image complete!';
            optDetailText.textContent = `Res: ${imgWidth}x${imgHeight} | Elapsed: ${data.stats.elapsed_seconds}s | Device: ${data.stats.device_name}`;

            statResolution.textContent = `${imgWidth} x ${imgHeight}`;
            statTotalPixels.textContent = (imgWidth * imgHeight).toLocaleString();
            statTotalSwaps.textContent = '0';
            statSortedPixels.textContent = `0 / ${(imgWidth * imgHeight).toLocaleString()} (0.00%)`;
            statCurrentAlgo.textContent = sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text;
            statSimState.textContent = 'Ready to sort';

            initSortingEngine();

            btnPrepare.disabled = false;
            btnLoadSample.disabled = false;
            btnPlayPause.disabled = false;
            btnStep.disabled = false;
            btnReset.disabled = false;
            btnDownload.disabled = false;
            btnExportGif.disabled = false;

            logStatus(`${data.stats.message || 'GPU optimization complete!'} Click [Start Sorting] to begin.`);
            return;
        }
    } catch (e) {
        console.warn('GPU sample calculation error, fallback to client:', e);
    }

    const [srcImg, tgtImg] = await Promise.all([
        loadImageElement(c1.toDataURL()),
        loadImageElement(c2.toDataURL())
    ]);
    await startHillClimbingOptimization(srcImg, tgtImg);
});

// ============================================================================
// Phase 2: Sorting Simulation Visualizer with Adaptive Rate Controller
// ============================================================================

function initSortingEngine() {
    if (!destinationMap || !sourcePixelsOriginal) return;

    // Reset main canvas to pure source original image
    mainData32.set(sourcePixelsOriginal);
    mainCtx.putImageData(mainImageData, 0, 0);

    const selectedAlgo = sortAlgoSelect.value;
    engine = new SortingEngine(imgWidth, imgHeight, sourcePixelsOriginal, destinationMap, selectedAlgo);

    statTotalSwaps.textContent = '0';
    statSortedPixels.textContent = `0 / ${(imgWidth * imgHeight).toLocaleString()} (0.00%)`;
    statCurrentAlgo.textContent = sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text;
    statSimState.textContent = 'Idle (Ready to start)';
    btnPlayPause.textContent = 'Start Sorting';
    btnPlayPause.classList.add('primary');
    btnExportGif.disabled = false;

    mainMeta.textContent = `Res: ${imgWidth}x${imgHeight} | Ready: ${statCurrentAlgo.textContent}`;
    swapAccumulator = 0;
}

sortAlgoSelect.addEventListener('change', () => {
    if (destinationMap) {
        const wasSorting = isSorting;
        if (wasSorting) pauseSorting();
        initSortingEngine();
        logStatus(`Sorting algorithm changed to [${sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text}] selected.`);
    }
});

// Execute sorting step with Adaptive Constant Rate Controller
function executeSortingStep() {
    if (!engine || engine.isDone) return;

    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0.001, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    let batchSize;
    if (adaptiveSpeedCheck.checked) {
        // Adaptive rate: targetSwapsPerSec * dt + accumulated remainder
        // At 75fps and 240,000 swaps/s -> exactly ~3,200 to 3,247 swaps/frame!
        swapAccumulator += targetSwapsPerSec * dt;
        batchSize = Math.floor(swapAccumulator);
        swapAccumulator -= batchSize;
        batchSize = Math.max(1, Math.min(150000, batchSize));
    } else {
        batchSize = getBatchSizeFromSlider(parseInt(speedSlider.value, 10));
    }

    const swapsDone = engine.step(batchSize);

    swapsSinceLastMetric += swapsDone;
    framesSinceLastMetric++;

    // Update main canvas buffer
    mainData32.set(engine.currentPixels);
    mainCtx.putImageData(mainImageData, 0, 0);

    // Periodic stats update
    if (now - lastMetricTime >= 150 || engine.isDone) {
        const elapsed = (now - lastMetricTime) / 1000;
        const sortedCount = engine.countSortedPixels();
        const percent = ((sortedCount / engine.totalPixels) * 100).toFixed(2);

        statTotalSwaps.textContent = engine.totalSwaps.toLocaleString();
        statSortedPixels.textContent = `${sortedCount.toLocaleString()} / ${engine.totalPixels.toLocaleString()} (${percent}%)`;

        const sps = Math.round(swapsSinceLastMetric / elapsed);
        const fps = Math.round(framesSinceLastMetric / elapsed);
        statSwapsPerSec.textContent = `${sps.toLocaleString()} swaps/s`;
        statFps.textContent = `${fps} FPS`;

        mainMeta.textContent = `Swaps: ${engine.totalSwaps.toLocaleString()} | Progress: ${percent}% | Current: ${swapsDone.toLocaleString()} / frame`;

        swapsSinceLastMetric = 0;
        framesSinceLastMetric = 0;
        lastMetricTime = now;
    }

    if (engine.isDone) {
        pauseSorting();
        statSimState.textContent = 'Complete!';
        btnPlayPause.textContent = 'Complete';
        btnPlayPause.disabled = true;
        logStatus('Complete! Source image has been fully transformed into the target mapping.');
    }
}

function sortingLoop() {
    if (!isSorting) return;

    executeSortingStep();

    if (!isSorting || engine.isDone) return;

    const delay = adaptiveSpeedCheck.checked ? 0 : parseInt(delaySlider.value, 10);
    if (delay > 0) {
        setTimeout(() => {
            if (isSorting) {
                animationFrameId = requestAnimationFrame(sortingLoop);
            }
        }, delay);
    } else {
        animationFrameId = requestAnimationFrame(sortingLoop);
    }
}

function startSorting() {
    if (!engine || isSorting || engine.isDone) return;
    isSorting = true;
    btnPlayPause.textContent = 'Pause Sorting';
    btnPlayPause.classList.remove('primary');
    statSimState.textContent = 'Sorting in progress...';
    lastFrameTime = performance.now();
    lastMetricTime = performance.now();
    swapAccumulator = 0;
    swapsSinceLastMetric = 0;
    framesSinceLastMetric = 0;
    logStatus(`[${statCurrentAlgo.textContent}] simulation started (Target speed: ${targetSwapsPerSec.toLocaleString()} swaps/s)...`);
    sortingLoop();
}

function pauseSorting() {
    if (!isSorting) return;
    isSorting = false;
    btnPlayPause.textContent = 'Resume Sorting';
    btnPlayPause.classList.add('primary');
    statSimState.textContent = 'Paused';
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    logStatus('Sorting simulation paused.');
}

btnPlayPause.addEventListener('click', () => {
    if (isSorting) {
        pauseSorting();
    } else {
        startSorting();
    }
});

btnStep.addEventListener('click', () => {
    if (isSorting) pauseSorting();
    executeSortingStep();
    logStatus('Executed 1 step.');
});

btnReset.addEventListener('click', () => {
    if (!engine) return;
    if (isSorting) pauseSorting();
    initSortingEngine();
    btnPlayPause.disabled = false;
    logStatus('Reset to initial source image.');
});

btnDownload.addEventListener('click', () => {
    if (!mainCanvas) return;
    const link = document.createElement('a');
    link.download = `pixelator_sorted_${sortAlgoSelect.value}_${Date.now()}.png`;
    link.href = mainCanvas.toDataURL('image/png');
    link.click();
    logStatus('Current canvas saved as PNG.');
});

// 7-second GIF Export (70 frames @ 10 fps = exactly 7.0s)
btnExportGif.addEventListener('click', async () => {
    if (!destinationMap || !sourcePixelsOriginal || imgWidth === 0 || imgHeight === 0) {
        alert('Please compute the intermediate optimization mapping first.');
        return;
    }

    const wasSorting = isSorting;
    if (wasSorting) pauseSorting();

    const originalBtnText = btnExportGif.textContent;
    btnExportGif.disabled = true;
    btnExportGif.textContent = 'Recording 7s GIF...';

    const selectedAlgo = sortAlgoSelect.value;
    logStatus(`Preparing 7-second GIF for [${sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text}]...`);

    try {
        const numFrames = 70;
        const durationMs = 100; // 70 * 100ms = 7000ms = 7.0 seconds

        // 1. Measure total swaps by running a fast simulation pass in memory
        let totalSwapsToComplete = 0;
        const measureEngine = new SortingEngine(imgWidth, imgHeight, sourcePixelsOriginal, destinationMap, selectedAlgo);
        while (!measureEngine.isDone) {
            const count = measureEngine.step(100000);
            totalSwapsToComplete += count;
            if (count === 0) break;
        }
        totalSwapsToComplete = Math.max(1, totalSwapsToComplete);
        console.log(`[GIF Export] Total swaps to complete: ${totalSwapsToComplete.toLocaleString()}`);

        // 2. Setup thumbnail canvas (fixed width 400px, preserving aspect ratio)
        const thumbWidth = 400;
        const thumbHeight = Math.max(1, Math.round((thumbWidth * imgHeight) / imgWidth));

        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = imgWidth;
        fullCanvas.height = imgHeight;
        const fullCtx = fullCanvas.getContext('2d');
        const fullImgData = fullCtx.createImageData(imgWidth, imgHeight);
        const fullData32 = new Uint32Array(fullImgData.data.buffer);

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbWidth;
        thumbCanvas.height = thumbHeight;
        const thumbCtx = thumbCanvas.getContext('2d');
        thumbCtx.imageSmoothingEnabled = true;
        thumbCtx.imageSmoothingQuality = 'high';

        // 3. New engine instance for recording 70 snapshots
        const recordEngine = new SortingEngine(imgWidth, imgHeight, sourcePixelsOriginal, destinationMap, selectedAlgo);
        const frames = [];

        for (let k = 0; k < numFrames; k++) {
            if (k === 0) {
                // First frame: initial source image (0 swaps)
            } else if (k === numFrames - 1) {
                // Final frame: run until complete
                while (!recordEngine.isDone) {
                    const stepDone = recordEngine.step(100000);
                    if (stepDone === 0) break;
                }
            } else {
                const targetSwaps = Math.round((k * totalSwapsToComplete) / (numFrames - 1));
                const delta = targetSwaps - recordEngine.totalSwaps;
                if (delta > 0 && !recordEngine.isDone) {
                    recordEngine.step(delta);
                }
            }

            fullData32.set(recordEngine.currentPixels);
            fullCtx.putImageData(fullImgData, 0, 0);

            thumbCtx.drawImage(fullCanvas, 0, 0, thumbWidth, thumbHeight);
            frames.push(thumbCanvas.toDataURL('image/jpeg', 0.85));

            if ((k + 1) % 10 === 0 || k === numFrames - 1) {
                btnExportGif.textContent = `Capturing (${k + 1}/${numFrames})...`;
                logStatus(`Capturing GIF frames: ${k + 1} / ${numFrames} (7.0s timeline)...`);
                await new Promise(r => setTimeout(r, 0));
            }
        }

        btnExportGif.textContent = 'Encoding GIF...';
        logStatus('Encoding 7.0-second GIF on server...');

        // 4. Send to /api/export-gif
        const response = await fetch('/api/export-gif', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                frames: frames,
                duration: durationMs,
                algo: selectedAlgo
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server returned HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = `pixelator_${selectedAlgo}_7s.gif`;
        downloadLink.click();
        URL.revokeObjectURL(downloadUrl);

        logStatus(`7-second GIF exported successfully (${(blob.size / 1024).toFixed(1)} KB)!`);
    } catch (err) {
        console.error('GIF export error:', err);
        alert('Failed to export GIF: ' + err.message);
        logStatus('GIF export failed: ' + err.message);
    } finally {
        btnExportGif.disabled = false;
        btnExportGif.textContent = originalBtnText;
    }
});

// Automatically load default project images on startup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDefaultProjectImages);
} else {
    loadDefaultProjectImages();
}

