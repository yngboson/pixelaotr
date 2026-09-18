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
        sourceFileHint.textContent = `선택된 파일: ${sourceInput.files[0].name} (${(sourceInput.files[0].size / 1024).toFixed(1)} KB)`;
        sourceFileHint.style.color = '#008800';
    } else {
        sourceFileHint.textContent = '기본 소스: 10047C68-3563-44F7-9125-63DE531F3A86.png (햄스터 V)';
        sourceFileHint.style.color = '#0055aa';
    }
});

targetInput.addEventListener('change', () => {
    if (targetInput.files && targetInput.files[0]) {
        targetFileHint.textContent = `선택된 파일: ${targetInput.files[0].name} (${(targetInput.files[0].size / 1024).toFixed(1)} KB)`;
        targetFileHint.style.color = '#008800';
    } else {
        targetFileHint.textContent = '기본 목표: Site-background-dark.webp';
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
        logStatus('기본 프로젝트 사진 로드 중...');
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
        statSimState.textContent = '기본 사진 대기 중';
        mainMeta.textContent = `해상도: ${imgWidth}x${imgHeight} | 기본 사진 준비 완료 (햄스터 V)`;

        sourceFileHint.textContent = `기본 소스: 10047C68-3563-44F7-9125-63DE531F3A86.png (${imgWidth}x${imgHeight})`;
        sourceFileHint.style.color = '#0055aa';
        targetFileHint.textContent = `기본 목표: Site-background-dark.webp`;
        targetFileHint.style.color = '#0055aa';

        logStatus(`기본 사진 준비 완료 (${imgWidth}x${imgHeight}, ${(imgWidth * imgHeight).toLocaleString()} 픽셀). 최적화 모드를 고른 뒤 [이미지 불러오기 및 중간 이미지 최적화 계산]을 누르세요.`);
    } catch (err) {
        console.warn('기본 이미지 로드 실패:', err);
        logStatus('기본 이미지 자동 로드 대기 중. 직접 사진 파일을 선택할 수 있습니다.');
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
        manualMinStepValue.textContent = '자동 극소값 수렴 (설정 불필요)';
    } else {
        modeAuto.disabled = false;
        modeManual.disabled = false;
        if (modeManual.checked) {
            manualMinStepSlider.disabled = false;
            manualSliderRow.style.opacity = '1.0';
            manualMinStepValue.textContent = `${parseInt(manualMinStepSlider.value, 10).toLocaleString()} 스텝`;
        } else {
            manualMinStepSlider.disabled = true;
            manualSliderRow.style.opacity = '0.5';
            manualMinStepValue.textContent = `${parseInt(manualMinStepSlider.value, 10).toLocaleString()} 스텝 (자동 계산 기준치)`;
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
    manualMinStepValue.textContent = `${parseInt(manualMinStepSlider.value, 10).toLocaleString()} 스텝`;
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
    speedValue.textContent = `${batch.toLocaleString()}회/프레임`;
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
    statusBar.textContent = `[상태] ${msg}`;
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
    statSimState.textContent = '중간 이미지 최적화 중...';
    mainMeta.textContent = `해상도: ${imgWidth}x${imgHeight} | 원본 소스 이미지 대기 중`;

    // Initialize Hill Climbing Optimizer
    const isAuto = modeAuto.checked;
    const manualSteps = parseInt(manualMinStepSlider.value, 10);
    optimizer = new HillClimbingOptimizer(imgWidth, imgHeight, sourcePixelsOriginal, targetPixelsTarget, {
        isAutoMinSteps: isAuto,
        manualMinSteps: manualSteps
    });

    // Show Progress UI
    optimizerProgressContainer.style.display = 'block';
    optStatusTitle.textContent = `내부 중간 이미지 생성 중 (${isAuto ? '자동 최소 스텝: ' + optimizer.minSteps.toLocaleString() : '수동 최소 스텝: ' + manualSteps.toLocaleString()})`;
    optProgressBar.value = 0;
    optPercentText.textContent = '0%';
    optDetailText.textContent = `시작 준비 중... 초기 오차: ${optimizer.initialDistance.toFixed(2)}`;

    btnPrepare.disabled = true;
    btnLoadSample.disabled = true;
    btnPlayPause.disabled = true;
    btnStep.disabled = true;
    btnReset.disabled = true;
    btnDownload.disabled = true;

    isOptimizing = true;
    logStatus(`1단계: 힐 클라이밍 최적화 시작 (최소 스텝: ${optimizer.minSteps.toLocaleString()})...`);

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
            optPercentText.textContent = `${percent}% (최소 스텝 확보 중)`;
        } else {
            optPercentText.textContent = `100% (수렴 대기 중)`;
        }

        optDetailText.textContent = `스텝: ${optimizer.stepsDone.toLocaleString()} / ${optimizer.minSteps.toLocaleString()} | 스왑: ${optimizer.totalSwaps.toLocaleString()} | 오차: ${optimizer.currentDistance.toFixed(2)}`;

        if (isDone) {
            // Optimization finished
            isOptimizing = false;
            destinationMap = optimizer.getDestinationMap();

            optStatusTitle.textContent = `중간 이미지 생성 완료! (최종 오차: ${optimizer.currentDistance.toFixed(2)})`;
            optProgressBar.value = 100;
            optPercentText.textContent = '100% 완료';

            initSortingEngine();

            btnPrepare.disabled = false;
            btnLoadSample.disabled = false;
            btnPlayPause.disabled = false;
            btnStep.disabled = false;
            btnReset.disabled = false;
            btnDownload.disabled = false;

            statSimState.textContent = '정렬 준비 완료';
            logStatus(`중간 이미지 생성 완료! 이제 정렬 알고리즘을 선택하고 [정렬 시작]을 누르세요.`);
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
        alert('소스 사진과 목표 사진을 선택하거나 기본 사진이 로드될 때까지 기다려 주세요.');
        return;
    }

    const fitMode = fitModeSelect.value;
    const isAuto = modeAuto.checked;
    const minSteps = parseInt(manualMinStepSlider.value, 10);
    const optMode = (optMode3D && optMode3D.checked) ? '3d_rgb_vector' : '5d_sliced';
    const optModeName = optMode === '3d_rgb_vector' ? '3D RGB 벡터 공간 매칭' : '5D 시공간 매칭';

    optimizerProgressContainer.style.display = 'block';
    optStatusTitle.textContent = `RTX 3080 Ti CUDA GPU 가속 [${optModeName}] 연산 중...`;
    optProgressBar.value = 30;
    optPercentText.textContent = 'GPU 연산 중...';
    optDetailText.textContent = `서버 GPU(PyTorch CUDA)로 초고속 [${optModeName}] 연산을 수행하고 있습니다.`;

    btnPrepare.disabled = true;
    btnResetDefault.disabled = true;
    btnLoadSample.disabled = true;
    btnPlayPause.disabled = true;
    btnStep.disabled = true;
    btnReset.disabled = true;
    btnDownload.disabled = true;

    logStatus(`서버로 이미지 전송 및 RTX 3080 Ti CUDA GPU 가속 [${optModeName}] 최적화 시작...`);

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
            optPercentText.textContent = '100% 완료 (GPU 가속)';
            optStatusTitle.textContent = data.stats.message || `GPU 가속 [${optModeName}] 중간 이미지 생성 완료!`;
            optDetailText.textContent = `모드: ${optModeName} | 해상도: ${imgWidth}x${imgHeight} | 소요시간: ${data.stats.elapsed_seconds}초 | 디바이스: ${data.stats.device_name}`;

            statResolution.textContent = `${imgWidth} x ${imgHeight}`;
            statTotalPixels.textContent = (imgWidth * imgHeight).toLocaleString();
            statTotalSwaps.textContent = '0';
            statSortedPixels.textContent = `0 / ${(imgWidth * imgHeight).toLocaleString()} (0.00%)`;
            statCurrentAlgo.textContent = sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text;
            statSimState.textContent = '정렬 준비 완료';

            initSortingEngine();

            btnPrepare.disabled = false;
            btnResetDefault.disabled = false;
            btnLoadSample.disabled = false;
            btnPlayPause.disabled = false;
            btnStep.disabled = false;
            btnReset.disabled = false;
            btnDownload.disabled = false;

            logStatus(`🎉 ${data.stats.message || 'GPU 가속 완료!'} 이제 정렬을 시작하세요.`);
            return;
        } else {
            throw new Error(`Server returned status ${response.status}`);
        }
    } catch (err) {
        console.warn('Backend GPU API failed or offline, falling back to local pipeline:', err);
        logStatus('서버 GPU API 응답 지연으로 로컬 브라우저 최적화로 폴백합니다...');
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
    optStatusTitle.textContent = '내장 샘플 RTX 3080 Ti CUDA GPU 가속 연산 중...';
    optProgressBar.value = 40;
    optPercentText.textContent = 'GPU 연산 중...';

    const blob1 = await new Promise(res => c1.toBlob(res, 'image/png'));
    const blob2 = await new Promise(res => c2.toBlob(res, 'image/png'));

    const optMode = (optMode3D && optMode3D.checked) ? '3d_rgb_vector' : '5d_sliced';
    const optModeName = optMode === '3d_rgb_vector' ? '3D RGB 벡터 공간 매칭' : '5D 시공간 매칭';

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
            optPercentText.textContent = '100% 완료 (GPU 가속)';
            optStatusTitle.textContent = data.stats.message || 'GPU 가속 중간 이미지 생성 완료!';
            optDetailText.textContent = `해상도: ${imgWidth}x${imgHeight} | 소요시간: ${data.stats.elapsed_seconds}초 | 디바이스: ${data.stats.device_name}`;

            statResolution.textContent = `${imgWidth} x ${imgHeight}`;
            statTotalPixels.textContent = (imgWidth * imgHeight).toLocaleString();
            statTotalSwaps.textContent = '0';
            statSortedPixels.textContent = `0 / ${(imgWidth * imgHeight).toLocaleString()} (0.00%)`;
            statCurrentAlgo.textContent = sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text;
            statSimState.textContent = '정렬 준비 완료';

            initSortingEngine();

            btnPrepare.disabled = false;
            btnLoadSample.disabled = false;
            btnPlayPause.disabled = false;
            btnStep.disabled = false;
            btnReset.disabled = false;
            btnDownload.disabled = false;

            logStatus(`🎉 ${data.stats.message || 'GPU 가속 완료!'} 이제 정렬을 시작하세요.`);
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
    statSimState.textContent = '대기 중 (시작 대기)';
    btnPlayPause.textContent = '정렬 시작 (Start)';
    btnPlayPause.classList.add('primary');

    mainMeta.textContent = `해상도: ${imgWidth}x${imgHeight} | 정렬 대기: ${statCurrentAlgo.textContent}`;
    swapAccumulator = 0;
}

sortAlgoSelect.addEventListener('change', () => {
    if (destinationMap) {
        const wasSorting = isSorting;
        if (wasSorting) pauseSorting();
        initSortingEngine();
        logStatus(`정렬 알고리즘이 [${sortAlgoSelect.options[sortAlgoSelect.selectedIndex].text}] 로 변경되었습니다.`);
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

        mainMeta.textContent = `스왑: ${engine.totalSwaps.toLocaleString()} | 진행도: ${percent}% | 현재: ${swapsDone.toLocaleString()}회/프레임`;

        swapsSinceLastMetric = 0;
        framesSinceLastMetric = 0;
        lastMetricTime = now;
    }

    if (engine.isDone) {
        pauseSorting();
        statSimState.textContent = '정렬 완료!';
        btnPlayPause.textContent = '정렬 완료';
        btnPlayPause.disabled = true;
        logStatus('🎉 정렬 완료! 원본 이미지가 정렬 알고리즘을 통해 중간 이미지로 완전히 변환되었습니다.');
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
    btnPlayPause.textContent = '일시정지 (Pause)';
    btnPlayPause.classList.remove('primary');
    statSimState.textContent = '정렬 진행 중...';
    lastFrameTime = performance.now();
    lastMetricTime = performance.now();
    swapAccumulator = 0;
    swapsSinceLastMetric = 0;
    framesSinceLastMetric = 0;
    logStatus(`[${statCurrentAlgo.textContent}] 정렬 시뮬레이션 시작 (목표 속도: ${targetSwapsPerSec.toLocaleString()} swaps/s)...`);
    sortingLoop();
}

function pauseSorting() {
    if (!isSorting) return;
    isSorting = false;
    btnPlayPause.textContent = '계속 진행 (Resume)';
    btnPlayPause.classList.add('primary');
    statSimState.textContent = '일시정지됨';
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    logStatus('정렬 시뮬레이션 일시정지됨.');
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
    logStatus('1스텝 수동 실행 완료.');
});

btnReset.addEventListener('click', () => {
    if (!engine) return;
    if (isSorting) pauseSorting();
    initSortingEngine();
    btnPlayPause.disabled = false;
    logStatus('초기 소스 이미지 상태로 리셋되었습니다.');
});

btnDownload.addEventListener('click', () => {
    if (!mainCanvas) return;
    const link = document.createElement('a');
    link.download = `pixelator_sorted_${sortAlgoSelect.value}_${Date.now()}.png`;
    link.href = mainCanvas.toDataURL('image/png');
    link.click();
    logStatus('현재 캔버스 이미지를 PNG 파일로 저장했습니다.');
});

// Automatically load default project images (Hamster V -> Rick Astley) on startup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDefaultProjectImages);
} else {
    loadDefaultProjectImages();
}

