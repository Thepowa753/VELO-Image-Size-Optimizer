// DOM Elements cache
const els = {};

const initApp = () => {
    // Cache elements by ID
    const ids = [
        'imageCompressorContainer', 'audioCompressorContainer', 'videoCompressorContainer', 
        'fileInput', 'initOverlay', 'appInterface',
        'fileListContainer', 'previewStage', 'imgOriginal', 'imgOptimized',
        'zoomFrame', 'veloContainer', 'filesCountLabel', 'privacyDate',
        'btnAbout', 'modalAbout', 'backdropAbout', 'btnCloseAbout',
        'modalPrivacy', 'backdropPrivacy', 'btnClosePrivacy', 'linkPrivacy',
        'btnSelectImages', 'btnAddImg', 'globalFormat', 'btnClear', 'btnZip',
        'btnResetZoom', 'compareSlider', 'compareOverlay'
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
};

document.addEventListener('DOMContentLoaded', initApp);
document.addEventListener('velo-ready', initApp);

function setupEventListeners() {
    // Modals Helper
    const toggle = (id, show) => {
        const el = document.getElementById(id);
        if (el) show ? el.classList.remove('d-none') : el.classList.add('d-none');
    };

    // File Input & Selection
    if (els.btnSelectImages) els.btnSelectImages.onclick = () => els.fileInput.click();
    if (els.btnAddImg) els.btnAddImg.onclick = () => els.fileInput.click();
    if (els.fileInput) els.fileInput.onchange = (e) => handleFiles(e.target.files);

    // Drag & Drop
    // Prevent adding duplicate global listeners if initApp runs multiple times
    if (!window.hasGlobalDragListeners) {
        window.addEventListener('dragover', (e) => e.preventDefault(), false);
        window.addEventListener('drop', (e) => e.preventDefault(), false);
        window.hasGlobalDragListeners = true;
    }

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
    if (els.btnResetZoom) els.btnResetZoom.onclick = resetZoom;

    // Comparison Slider
    setupComparisonSlider();

    // Zoom Interaction (Pan & Wheel)
    if (els.veloContainer) {
        els.veloContainer.onwheel = handleWheel;
        els.veloContainer.onmousedown = startDrag;

        // Remove existing listeners before adding to avoid duplicates
        window.removeEventListener('mousemove', drag);
        window.removeEventListener('mouseup', stopDrag);

        window.addEventListener('mousemove', drag);
        window.addEventListener('mouseup', stopDrag);
    }
}

// Comparison Slider Functionality
function setupComparisonSlider() {
    if (!els.compareSlider || !els.compareOverlay) return;

    const slider = els.compareSlider;
    const overlay = els.compareOverlay;

    const startSliding = (e) => {
        state.isSliding = true;
        e.preventDefault();
        e.stopPropagation();
    };

    const slide = (e) => {
        if (!state.isSliding) return;
        
        const container = els.zoomFrame;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        let x = e.clientX - rect.left;
        
        // Clamp between 0 and width
        x = Math.max(0, Math.min(x, rect.width));
        
        const percentage = (x / rect.width) * 100;
        
        slider.style.left = percentage + '%';
        overlay.style.width = percentage + '%';
    };

    const stopSliding = () => {
        state.isSliding = false;
    };

    // Mouse events
    slider.addEventListener('mousedown', startSliding);
    window.addEventListener('mousemove', slide);
    window.addEventListener('mouseup', stopSliding);

    // Touch events for mobile
    slider.addEventListener('touchstart', (e) => {
        state.isSliding = true;
        e.preventDefault();
        e.stopPropagation();
    });

    window.addEventListener('touchmove', (e) => {
        if (!state.isSliding) return;
        
        const touch = e.touches[0];
        const container = els.zoomFrame;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        let x = touch.clientX - rect.left;
        
        x = Math.max(0, Math.min(x, rect.width));
        const percentage = (x / rect.width) * 100;
        
        slider.style.left = percentage + '%';
        overlay.style.width = percentage + '%';
    });

    window.addEventListener('touchend', stopSliding);
}
