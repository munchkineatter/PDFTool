window.onload = function() {
    const mergeFile = document.getElementById('merge-file');
    const mergeList = document.getElementById('merge-list');
    const mergeBtn = document.getElementById('merge-btn');
    const clearMergeBtn = document.getElementById('clear-merge-btn');
    const mergeProgressBar = document.querySelector('#merge-progress .progress-bar');
    const mergeProgressContainer = document.getElementById('merge-progress');

    let mergeFiles = [];

    mergeFile.addEventListener('change', updateMergeList);
    mergeBtn.addEventListener('click', mergeDocuments);
    clearMergeBtn.addEventListener('click', clearMergeList);

    function updateMergeList(event) {
        const newFiles = Array.from(event.target.files);
        mergeFiles = [...mergeFiles, ...newFiles];
        renderMergeList();
    }

    function renderMergeList() {
        mergeList.innerHTML = mergeFiles.map((file, index) => `
            <div class="file-item" data-index="${index}">
                <span class="drag-handle">☰</span>
                <span>${file.name}</span>
                <button class="btn btn-sm btn-danger remove-file" data-index="${index}">Remove</button>
            </div>
        `).join('');
        
        mergeBtn.disabled = mergeFiles.length === 0;
        clearMergeBtn.disabled = mergeFiles.length === 0;

        // Add event listeners for remove buttons
        document.querySelectorAll('.remove-file').forEach(button => {
            button.addEventListener('click', removeFile);
        });

        if (mergeFiles.length > 0 && !mergeList.sortable) {
            mergeList.sortable = new Sortable(mergeList, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: function(evt) {
                    const item = mergeFiles[evt.oldIndex];
                    mergeFiles.splice(evt.oldIndex, 1);
                    mergeFiles.splice(evt.newIndex, 0, item);
                    renderMergeList();
                }
            });
        }
    }

    function removeFile(event) {
        const index = event.target.getAttribute('data-index');
        mergeFiles.splice(index, 1);
        renderMergeList();
    }

    function clearMergeList() {
        mergeFile.value = '';
        mergeFiles = [];
        renderMergeList();
    }

    async function mergeDocuments() {
        if (mergeFiles.length === 0) return;

        mergeProgressContainer.classList.remove('d-none');
        mergeProgressBar.style.width = '0%';
        mergeBtn.disabled = true;

        const mergedPdf = await PDFLib.PDFDocument.create();

        for (let i = 0; i < mergeFiles.length; i++) {
            const file = mergeFiles[i];
            const fileData = await file.arrayBuffer();

            if (file.type === 'application/pdf') {
                const pdfDoc = await PDFLib.PDFDocument.load(fileData);
                const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            } else if (file.type.startsWith('image/')) {
                const image = file.type === 'image/jpeg' || file.type === 'image/jpg'
                    ? await mergedPdf.embedJpg(fileData)
                    : await mergedPdf.embedPng(fileData);
                
                const page = mergedPdf.addPage();
                const { width, height } = image.size();
                const scaleX = page.getWidth() / width;
                const scaleY = page.getHeight() / height;
                const scale = Math.min(scaleX, scaleY);
                
                page.drawImage(image, {
                    x: (page.getWidth() - width * scale) / 2,
                    y: (page.getHeight() - height * scale) / 2,
                    width: width * scale,
                    height: height * scale,
                });
            }

            updateMergeProgress((i + 1) / mergeFiles.length * 100);
        }

        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, 'merged_document.pdf');

        mergeBtn.disabled = false;
        mergeProgressContainer.classList.add('d-none');
    }

    function updateMergeProgress(percentage) {
        mergeProgressBar.style.width = `${percentage}%`;
        mergeProgressBar.textContent = `${Math.round(percentage)}%`;
    }
};
