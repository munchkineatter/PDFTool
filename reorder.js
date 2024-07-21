document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('pdf-file');
    const fileSelect = document.getElementById('file-select');
    const fileInfo = document.getElementById('file-info');
    const pageList = document.getElementById('page-list');
    const sizeBtn = document.getElementById('size-btn');
    const saveBtn = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');

    let pdfDocument = null;
    let pageOrder = [];
    let currentSize = 'medium';

    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('highlight');
    }

    function unhighlight() {
        dropArea.classList.remove('highlight');
    }

    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    fileSelect.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        if (files.length > 0 && files[0].type === 'application/pdf') {
            loadPDF(files[0]);
        } else {
            alert('Please select a valid PDF file.');
        }
    }

    async function loadPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        pdfDocument = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        fileInfo.textContent = `File loaded: ${file.name}`;
        fileInfo.classList.remove('d-none');
        renderPages();
    }

    function renderPages() {
        pageList.innerHTML = '';
        pageOrder = [];

        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const pageItem = document.createElement('div');
            pageItem.className = 'page-item';
            pageItem.innerHTML = `
                <canvas></canvas>
                <div class="page-number">${i}</div>
                <div class="delete-page">×</div>
                <div class="rotate-page">↻</div>
            `;
            pageList.appendChild(pageItem);
            pageOrder.push({page: i, rotation: 0});

            renderPage(i, pageItem.querySelector('canvas'));
            
            pageItem.querySelector('.delete-page').addEventListener('click', () => deletePage(i));
            pageItem.querySelector('.rotate-page').addEventListener('click', () => rotatePage(i));
        }

        updatePageNumbers();
        initSortable();
        saveBtn.disabled = false;
        clearBtn.disabled = false;
    }

    async function renderPage(pageNumber, canvas) {
        const page = await pdfDocument.getPage(pageNumber);
        const scale = getScale(currentSize);
        const viewport = page.getViewport({scale});
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
        };
        await page.render(renderContext);
    }

    function getScale(size) {
        switch (size) {
            case 'small': return 0.5;
            case 'medium': return 0.75;
            case 'large': return 1;
            default: return 0.75;
        }
    }

    function initSortable() {
        new Sortable(pageList, {
            animation: 150,
            onEnd: updatePageOrder
        });
    }

    function updatePageOrder() {
        pageOrder = Array.from(pageList.children).map((item, index) => {
            return {
                page: parseInt(item.querySelector('.page-number').textContent),
                rotation: pageOrder[index].rotation
            };
        });
        updatePageNumbers();
    }

    function updatePageNumbers() {
        pageList.querySelectorAll('.page-number').forEach((numberElement, index) => {
            numberElement.textContent = index + 1;
        });
    }

    function deletePage(pageNumber) {
        pageList.removeChild(pageList.children[pageNumber - 1]);
        pageOrder.splice(pageNumber - 1, 1);
        updatePageNumbers();
    }

    function rotatePage(pageNumber) {
        const pageItem = pageList.children[pageNumber - 1];
        const canvas = pageItem.querySelector('canvas');
        const currentRotation = pageOrder[pageNumber - 1].rotation;
        const newRotation = (currentRotation + 90) % 360;
        
        pageOrder[pageNumber - 1].rotation = newRotation;
        canvas.style.transform = `rotate(${newRotation}deg)`;
    }

    sizeBtn.addEventListener('click', () => {
        const sizes = ['small', 'medium', 'large'];
        currentSize = sizes[(sizes.indexOf(currentSize) + 1) % sizes.length];
        sizeBtn.textContent = `Size: ${currentSize.charAt(0).toUpperCase() + currentSize.slice(1)}`;
        renderPages();
    });

    saveBtn.addEventListener('click', async () => {
        const pdfDoc = await PDFLib.PDFDocument.create();
        const copiedPages = await pdfDoc.copyPages(pdfDocument, pageOrder.map(p => p.page - 1));

        for (let i = 0; i < copiedPages.length; i++) {
            const page = copiedPages[i];
            pdfDoc.addPage(page);
            if (pageOrder[i].rotation !== 0) {
                const rotatedPage = pdfDoc.getPage(i);
                rotatedPage.setRotation(PDFLib.degrees(pageOrder[i].rotation));
            }
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, 'reordered.pdf');
    });

    clearBtn.addEventListener('click', () => {
        pdfDocument = null;
        pageOrder = [];
        pageList.innerHTML = '';
        fileInfo.classList.add('d-none');
        saveBtn.disabled = true;
        clearBtn.disabled = true;
    });
});
