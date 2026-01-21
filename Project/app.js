/**
 * VELO - Pure JS Refactoring
 * Handles image compression, state management, and UI updates locally.
 */

const state = {
    files: [], // Array of file objects { id, name, originalFile, originalUrl, compressedBlob, compressedUrl, quality, format, size, compressedSize, savings }
    selectedFileId: null,
    globalFormat: 'jpeg',
    showingOriginal: false,
    zoom: { scale: 1, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 }
};

// DOM Elements cache
const els = {};

document.addEventListener('DOMContentLoaded', () => {
    // Cache elements by ID
    const ids = [
        'dropZone', 'fileInput', 'initOverlay', 'appInterface',
        'fileListContainer', 'previewStage', 'imgOriginal', 'imgOptimized',
        'zoomFrame', 'veloContainer', 'filesCountLabel', 'privacyDate',
        'btnAbout', 'modalAbout', 'backdropAbout', 'btnCloseAbout',
        'modalPrivacy', 'backdropPrivacy', 'btnClosePrivacy', 'linkPrivacy',
        'btnSelectImages', 'btnAddImg', 'globalFormat', 'btnClear', 'btnZip',
        'btnShowOriginal', 'btnShowOptimized', 'btnResetZoom'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) els[id] = el;
    });

    // Set Date
    if (els.privacyDate) {
        els.privacyDate.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
    }

    setupEventListeners();
});

function setupEventListeners() {
    // Modals Helper
    const toggle = (id, show) => {
        const el = document.getElementById(id);
        if (el) show ? el.classList.remove('d-none') : el.classList.add('d-none');
    };

    // About Modal
    if (els.btnAbout) els.btnAbout.onclick = () => toggle('modalAbout', true);
    if (els.backdropAbout) els.backdropAbout.onclick = () => toggle('modalAbout', false);
    if (els.btnCloseAbout) els.btnCloseAbout.onclick = () => toggle('modalAbout', false);

    // Privacy Modal
    if (els.linkPrivacy) els.linkPrivacy.onclick = (e) => { e.preventDefault(); toggle('modalPrivacy', true); };
    if (els.backdropPrivacy) els.backdropPrivacy.onclick = () => toggle('modalPrivacy', false);
    if (els.btnClosePrivacy) els.btnClosePrivacy.onclick = () => toggle('modalPrivacy', false);

    // File Input & Selection
    if (els.btnSelectImages) els.btnSelectImages.onclick = () => els.fileInput.click();
    if (els.btnAddImg) els.btnAddImg.onclick = () => els.fileInput.click();
    if (els.fileInput) els.fileInput.onchange = (e) => handleFiles(e.target.files);

    // Drag & Drop
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);

    if (els.dropZone) {
        els.dropZone.ondragover = (e) => { e.preventDefault(); els.dropZone.classList.add('border-primary'); };
        els.dropZone.ondragleave = () => els.dropZone.classList.remove('border-primary');
        els.dropZone.ondrop = (e) => {
            e.preventDefault();
            els.dropZone.classList.remove('border-primary');
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        };
    }

    // Global Actions
    if (els.btnClear) els.btnClear.onclick = clearAll;
    if (els.btnZip) els.btnZip.onclick = downloadZip;
    if (els.globalFormat) els.globalFormat.onchange = (e) => {
        state.globalFormat = e.target.value;
        state.files.forEach(f => {
            f.format = state.globalFormat;
            processFile(f);
        });
    };

    // Zoom Controls
    if (els.btnShowOriginal) els.btnShowOriginal.onclick = () => setPreviewMode(true);
    if (els.btnShowOptimized) els.btnShowOptimized.onclick = () => setPreviewMode(false);
    if (els.btnResetZoom) els.btnResetZoom.onclick = resetZoom;

    // Zoom Interaction (Pan & Wheel)
    if (els.veloContainer) {
        els.veloContainer.onwheel = handleWheel;
        els.veloContainer.onmousedown = startDrag;
        window.addEventListener('mousemove', drag);
        window.addEventListener('mouseup', stopDrag);
    }
}

// --- File Handling ---

async function handleFiles(fileList) {
    const newFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (newFiles.length === 0) return;

    for (const file of newFiles) {
        // Avoid duplicates by name
        if (state.files.some(f => f.name === file.name)) continue;

        const fileEntry = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            originalFile: file,
            originalUrl: URL.createObjectURL(file),
            size: file.size,
            quality: 75,
            format: state.globalFormat,
            compressedBlob: null,
            compressedUrl: null,
            compressedSize: 0,
            savings: 0
        };

        state.files.push(fileEntry);
        if (!state.selectedFileId) state.selectedFileId = fileEntry.id;

        // Process (Compress)
        await processFile(fileEntry);
    }

    if (els.fileInput) els.fileInput.value = ''; // Reset input
    updateUI();
}

async function processFile(fileEntry) {
    const img = new Image();
    img.src = fileEntry.originalUrl;
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const mimeType = `image/${fileEntry.format === 'jpg' ? 'jpeg' : fileEntry.format}`;

    // Compression logic using Canvas API
    canvas.toBlob((blob) => {
        if (fileEntry.compressedUrl) URL.revokeObjectURL(fileEntry.compressedUrl);

        fileEntry.compressedBlob = blob;
        fileEntry.compressedUrl = URL.createObjectURL(blob);
        fileEntry.compressedSize = blob.size;

        // Calculate savings
        fileEntry.savings = 100 - ((blob.size / fileEntry.size) * 100);

        updateUI(); // Refresh UI with new stats
    }, mimeType, fileEntry.quality / 100);
}

function removeFile(id) {
    const idx = state.files.findIndex(f => f.id === id);
    if (idx > -1) {
        const f = state.files[idx];
        URL.revokeObjectURL(f.originalUrl);
        if (f.compressedUrl) URL.revokeObjectURL(f.compressedUrl);
        state.files.splice(idx, 1);

        if (state.selectedFileId === id) {
            state.selectedFileId = state.files.length > 0 ? state.files[0].id : null;
        }
        updateUI();
    }
}

function clearAll() {
    state.files.forEach(f => {
        URL.revokeObjectURL(f.originalUrl);
        if (f.compressedUrl) URL.revokeObjectURL(f.compressedUrl);
    });
    state.files = [];
    state.selectedFileId = null;
    updateUI();
}

// --- UI Rendering ---

function updateUI() {
    // Toggle Views (Init vs App)
    if (state.files.length === 0) {
        if (els.initOverlay) els.initOverlay.classList.remove('d-none');
        if (els.appInterface) {
            els.appInterface.classList.add('d-none');
            els.appInterface.classList.remove('d-flex');
        }
    } else {
        if (els.initOverlay) els.initOverlay.classList.add('d-none');
        if (els.appInterface) {
            els.appInterface.classList.remove('d-none');
            els.appInterface.classList.add('d-flex');
        }
    }

    if (els.filesCountLabel) els.filesCountLabel.textContent = `SELECTED FILES (${state.files.length})`;
    renderFileList();
    renderPreview();
}

function renderFileList() {
    if (!els.fileListContainer) return;
    els.fileListContainer.innerHTML = '';

    state.files.forEach(file => {
        const isSelected = file.id === state.selectedFileId;
        const div = document.createElement('div');
        div.className = `file-item p-2 mb-2 rounded ${isSelected ? 'active border border-primary' : 'border border-secondary'}`;
        div.style.cursor = 'pointer';
        div.onclick = () => { state.selectedFileId = file.id; updateUI(); };

        const savingsText = file.savings >= 0 ? `-${file.savings.toFixed(1)}%` : `+${Math.abs(file.savings).toFixed(1)}%`;
        const savingsClass = file.compressedSize > file.size ? 'text-danger' : 'text-success';

        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="text-truncate max-w-75">
                    <div class="text-white fw-bold small">${file.name}</div>
                    <div class="mt-1">
                        <small class="">Before: ${formatSize(file.size)}</small>
                        <small class="${savingsClass} fw-bold ms-2">After: ${formatSize(file.compressedSize)} (${savingsText})</small>
                    </div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn text-primary p-1 btn-download" style="width: 35px;" title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" id="icon-download" style="width: 25px;" viewBox="0 0 640 640"><path fill="currentColor" d="M352 96C352 78.3 337.7 64 320 64C302.3 64 288 78.3 288 96L288 306.7L246.6 265.3C234.1 252.8 213.8 252.8 201.3 265.3C188.8 277.8 188.8 298.1 201.3 310.6L297.3 406.6C309.8 419.1 330.1 419.1 342.6 406.6L438.6 310.6C451.1 298.1 451.1 277.8 438.6 265.3C426.1 252.8 405.8 252.8 393.3 265.3L352 306.7L352 96zM160 384C124.7 384 96 412.7 96 448L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 448C544 412.7 515.3 384 480 384L433.1 384L376.5 440.6C345.3 471.8 294.6 471.8 263.4 440.6L206.9 384L160 384zM464 440C477.3 440 488 450.7 488 464C488 477.3 477.3 488 464 488C450.7 488 440 477.3 440 464C440 450.7 450.7 440 464 440z" /></svg>
                    </button>
                    <button class="btn text-primary p-1 btn-reset" title="Reset Quality" style="width: 35px;" title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px;" viewBox="0 0 512 512"><path fill="currentColor" d="M48.5 224H40c-13.3 0-24-10.7-24-24V72c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2L98.6 96.6c87.6-86.5 228.7-86.2 315.8 1c87.5 87.5 87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3c-62.2-62.2-162.7-62.5-225.3-1L185 183c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8H48.5z"/></svg>
                    </button>
                    <button class="btn text-danger p-1 btn-remove" title="Remove" style="width: 35px; fill: white;" title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px;" viewBox="0 0 384 512"><path fill="red" d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>
                    </button>
                </div>
            </div>
            <div class="row align-items-center g-2 border-top border-secondary pt-2 mt-1">
                <div class="col-auto">
                    <select class="form-select form-select-sm bg-dark text-white border-secondary p-0 ps-1 select-xs file-format">
                        <option value="jpeg" ${file.format === 'jpeg' ? 'selected' : ''}>JPG</option>
                        <option value="webp" ${file.format === 'webp' ? 'selected' : ''}>WEBP</option>
                        <option value="png" ${file.format === 'png' ? 'selected' : ''}>PNG</option>
                    </select>
                </div>
                <div class="col d-flex align-items-center gap-2">
                    <input type="range" class="form-range file-quality" min="1" max="100" step="1" value="${file.quality}">
                    <span class="badge bg-primary badge-xs">${file.quality}%</span>
                </div>
            </div>
        `;

        // Bind Item Events
        div.querySelector('.btn-remove').onclick = (e) => { e.stopPropagation(); removeFile(file.id); };
        div.querySelector('.btn-reset').onclick = (e) => {
            e.stopPropagation();
            file.quality = 75;
            state.selectedFileId = file.id;
            processFile(file);
        };
        div.querySelector('.btn-download').onclick = (e) => {
            e.stopPropagation();
            downloadSingle(file);
        };

        const formatSel = div.querySelector('.file-format');
        formatSel.onclick = (e) => e.stopPropagation();
        formatSel.onchange = (e) => { file.format = e.target.value; processFile(file); };

        const qualityRange = div.querySelector('.file-quality');
        qualityRange.onclick = (e) => e.stopPropagation();
        qualityRange.oninput = (e) => {
            file.quality = parseInt(e.target.value);
            div.querySelector('.badge').textContent = file.quality + '%';
        };
        qualityRange.onchange = () => processFile(file); // Commit change on release

        els.fileListContainer.appendChild(div);
    });
}

function renderPreview() {
    const file = state.files.find(f => f.id === state.selectedFileId);
    if (!file) {
        if (els.previewStage) els.previewStage.classList.add('d-none');
        return;
    }

    if (els.previewStage) els.previewStage.classList.remove('d-none');

    // Only update src if changed to prevent flickering
    if (els.imgOriginal && els.imgOriginal.src !== file.originalUrl) {
        els.imgOriginal.src = file.originalUrl;
        resetZoom();
    }
    // Always update optimized as it changes often
    if (els.imgOptimized && file.compressedUrl) els.imgOptimized.src = file.compressedUrl;

    setPreviewMode(state.showingOriginal);
}

function setPreviewMode(showOriginal) {
    state.showingOriginal = showOriginal;
    if (showOriginal) {
        if (els.imgOriginal) { els.imgOriginal.classList.remove('d-none'); els.imgOriginal.classList.add('d-block'); }
        if (els.imgOptimized) { els.imgOptimized.classList.add('d-none'); els.imgOptimized.classList.remove('d-block'); }
        if (els.btnShowOriginal) els.btnShowOriginal.classList.add('active');
        if (els.btnShowOptimized) els.btnShowOptimized.classList.remove('active');
    } else {
        if (els.imgOriginal) { els.imgOriginal.classList.add('d-none'); els.imgOriginal.classList.remove('d-block'); }
        if (els.imgOptimized) { els.imgOptimized.classList.remove('d-none'); els.imgOptimized.classList.add('d-block'); }
        if (els.btnShowOriginal) els.btnShowOriginal.classList.remove('active');
        if (els.btnShowOptimized) els.btnShowOptimized.classList.add('active');
    }
}

// --- Zoom Logic ---
function resetZoom() {
    state.zoom = { scale: 1, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 };
    applyZoom();
}

function applyZoom() {
    if (els.zoomFrame) els.zoomFrame.style.transform = `translate(${state.zoom.x}px, ${state.zoom.y}px) scale(${state.zoom.scale})`;
}

function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    state.zoom.scale *= delta;
    state.zoom.scale = Math.min(Math.max(0.1, state.zoom.scale), 10); // Clamp
    applyZoom();
}

function startDrag(e) {
    state.zoom.isDragging = true;
    state.zoom.startX = e.clientX - state.zoom.x;
    state.zoom.startY = e.clientY - state.zoom.y;
    if (els.veloContainer) els.veloContainer.style.cursor = 'grabbing';
}

function drag(e) {
    if (!state.zoom.isDragging) return;
    e.preventDefault();
    state.zoom.x = e.clientX - state.zoom.startX;
    state.zoom.y = e.clientY - state.zoom.startY;
    applyZoom();
}

function stopDrag() {
    state.zoom.isDragging = false;
    if (els.veloContainer) els.veloContainer.style.cursor = 'grab';
}

// --- Utilities ---

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function downloadSingle(file) {
    const a = document.createElement('a');
    a.href = file.compressedUrl;
    const ext = file.format === 'jpeg' ? 'jpg' : file.format;
    a.download = file.name.substring(0, file.name.lastIndexOf('.')) + '.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function downloadZip() {
    if (state.files.length === 0) return;

    const zip = new JSZip();

    state.files.forEach(file => {
        const ext = file.format === 'jpeg' ? 'jpg' : file.format;
        const name = file.name.substring(0, file.name.lastIndexOf('.')) + '.' + ext;
        // Get blob data
        zip.file(name, file.compressedBlob);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = "images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}