window.onload = function() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

    const pdfFile = document.getElementById('pdf-file');
    const fileList = document.getElementById('file-list');
    const pageListContainer = document.getElementById('page-list-container');
    const pageList = document.getElementById('page-list');
    const saveBtn = document.getElementById('save-btn');
    const sizeBtn = document.getElementById('size-btn');
    const clearReorderBtn = document.getElementById('clear-reorder-btn');

    let pdfDocuments = [];
    let pageOrder = [];
    let pageSizes = ['small', 'medium', 'large', 'xl', 'xxl'];
    let currentSizeIndex = 1;

    pdfFile.addEventListener('change', updateFileList);
    saveBtn.addEventListener('click', saveMergedAndReorderedPDF);
    sizeBtn.addEventListener('click', cyclePageSize);
    clearReorderBtn.addEventListener('click', clearReorderList);
    window.addEventListener('resize', debounce(updateLayout, 250));

    function updateFileList(event) {
        const newFiles = Array.from(event.target.files);
        pdfDocuments = [...pdfDocuments, ...newFiles];
        renderFileList();
        loadPDFs();
    }

    function renderFileList() {
        fileList.innerHTML = pdfDocuments.map((file, index) => `
            <div class="file-item">
                <span>${file.name}</span>
                <button class="btn btn-sm btn-danger remove-file" data-index="${index}">Remove</button>
            </div>
        `).join('');
        
        saveBtn.disabled = pdfDocuments.length === 0;
        clearReorderBtn.disabled = pdfDocuments.length === 0;

        // Add event listeners for remove buttons
        document.querySelectorAll('.remove-file').forEach(button => {
            button.addEventListener('click', removeFile);
        });
    }

    function removeFile(event) {
        const index = event.target.getAttribute('data-index');
        pdfDocuments.splice(index, 1);
        renderFileList();
        loadPDFs();
    }

    function clearReorderList() {
        pdfFile.value = '';
        pdfDocuments = [];
        pageOrder = [];
        pageList.innerHTML = '';
        renderFileList();
    }

    function cyclePageSize() {
        currentSizeIndex = (currentSizeIndex + 1) % pageSizes.length;
        updateLayout();
    }

    function updateLayout() {
        const containerWidth = pageListContainer.offsetWidth;
        const size = pageSizes[currentSizeIndex];
        const pageSize = size === 'small' ? 100 : 
                         (size === 'medium' ? 150 : 
                         (size === 'large' ? 200 :
                         (size === 'xl' ? 250 : 300))); // xxl size
        const gap = 20;

        const columns = Math.floor((containerWidth + gap) / (pageSize + gap));

        pageList.style.gridTemplateColumns = `repeat(${columns}, ${pageSize}px)`;
        
        pageList.querySelectorAll('.page-item').forEach(item => {
            item.style.width = `${pageSize}px`;
        });

        sizeBtn.textContent = `Size: ${size.toUpperCase()}`;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async function loadPDFs() {
        if (pdfDocuments.length === 0) return;

        pageList.innerHTML = '';
        pageOrder = [];

        for (let i = 0; i < pdfDocuments.length; i++) {
            const file = pdfDocuments[i];
            const arrayBuffer = await file.arrayBuffer();
            const pdfDocument = await pdfjsLib.getDocument({data: arrayBuffer}).promise;

            for (let j = 1; j <= pdfDocument.numPages; j++) {
                const page = await pdfDocument.getPage(j);
                const scale = 1;
                const viewport = page.getViewport({scale});

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({canvasContext: context, viewport}).promise;

                const pageItem = document.createElement('div');
                pageItem.className = 'page-item';
                pageItem.appendChild(canvas);
                pageItem.setAttribute('data-pdf', i);
                pageItem.setAttribute('data-page', j);
                pageItem.setAttribute('data-rotation', '0');

                const pageNumber = document.createElement('div');
                pageNumber.className = 'page-number';
                pageNumber.innerHTML = `<span class="current-number">${pageOrder.length + 1}</span> <span class="original-number">(PDF ${i + 1}, Page ${j})</span>`;
                pageItem.appendChild(pageNumber);

                // Add delete button
                const deleteButton = document.createElement('div');
                deleteButton.className = 'delete-page';
                deleteButton.innerHTML = '×';
                deleteButton.addEventListener('click', deletePage);
                pageItem.appendChild(deleteButton);

                // Add rotate button
                const rotateButton = document.createElement('div');
                rotateButton.className = 'rotate-page';
                rotateButton.innerHTML = '↻';
                rotateButton.addEventListener('click', rotatePage);
                pageItem.appendChild(rotateButton);

                pageList.appendChild(pageItem);
                pageOrder.push({pdf: i, page: j, rotation: 0});
            }
        }

        if (!pageList.sortable) {
            pageList.sortable = new Sortable(pageList, {
                animation: 150,
                onEnd: function(evt) {
                    const item = pageOrder[evt.oldIndex];
                    pageOrder.splice(evt.oldIndex, 1);
                    pageOrder.splice(evt.newIndex, 0, item);
                    updatePageNumbers();
                }
            });
        }

        updateLayout();
        updatePageNumbers();
    }

    function updatePageNumbers() {
        const pageItems = pageList.querySelectorAll('.page-item');
        pageItems.forEach((item, index) => {
            const currentNumber = item.querySelector('.current-number');
            currentNumber.textContent = index + 1;
        });
    }

    function deletePage(event) {
        const pageItem = event.target.closest('.page-item');
        const index = Array.from(pageList.children).indexOf(pageItem);
        
        pageOrder.splice(index, 1);
        pageItem.remove();
        
        updatePageNumbers();
        
        if (pageOrder.length === 0) {
            saveBtn.disabled = true;
            clearReorderBtn.disabled = true;
        }
    }

    function rotatePage(event) {
        const pageItem = event.target.closest('.page-item');
        const index = Array.from(pageList.children).indexOf(pageItem);
        const currentRotation = parseInt(pageItem.getAttribute('data-rotation')) || 0;
        const newRotation = (currentRotation + 90) % 360;

        pageItem.setAttribute('data-rotation', newRotation);
        pageItem.querySelector('canvas').style.transform = `rotate(${newRotation}deg)`;

        pageOrder[index].rotation = newRotation;
    }

    async function saveMergedAndReorderedPDF() {
        if (pdfDocuments.length === 0 || pageOrder.length === 0) {
            alert('Please upload at least one PDF file first.');
            return;
        }

        const mergedPdf = await PDFLib.PDFDocument.create();

        for (let item of pageOrder) {
            const srcDoc = await PDFLib.PDFDocument.load(await pdfDocuments[item.pdf].arrayBuffer());
            const [copiedPage] = await mergedPdf.copyPages(srcDoc, [item.page - 1]);
            
            if (item.rotation !== 0) {
                copiedPage.setRotation(PDFLib.degrees(item.rotation));
            }
            
            mergedPdf.addPage(copiedPage);
        }

        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, 'merged_reordered_and_rotated_document.pdf');
    }
};