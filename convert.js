window.onload = function() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

    const pdfFile = document.getElementById('pdf-file');
    const fileList = document.getElementById('file-list');
    const convertBtn = document.getElementById('convert-btn');
    const clearConvertBtn = document.getElementById('clear-convert-btn');
    const progressBar = document.querySelector('.progress-bar');
    const progressContainer = document.getElementById('progress');

    let convertFiles = [];

    pdfFile.addEventListener('change', updateFileList);
    convertBtn.addEventListener('click', convertPDFs);
    clearConvertBtn.addEventListener('click', clearConvertList);

    function updateFileList(event) {
        const newFiles = Array.from(event.target.files);
        convertFiles = [...convertFiles, ...newFiles];
        renderConvertList();
    }

    function renderConvertList() {
        fileList.innerHTML = convertFiles.map((file, index) => `
            <div class="file-item">
                <span>${file.name}</span>
                <button class="btn btn-sm btn-danger remove-file" data-index="${index}">Remove</button>
            </div>
        `).join('');
        
        convertBtn.disabled = convertFiles.length === 0;
        clearConvertBtn.disabled = convertFiles.length === 0;

        // Add event listeners for remove buttons
        document.querySelectorAll('.remove-file').forEach(button => {
            button.addEventListener('click', removeFile);
        });
    }

    function removeFile(event) {
        const index = event.target.getAttribute('data-index');
        convertFiles.splice(index, 1);
        renderConvertList();
    }

    function clearConvertList() {
        pdfFile.value = '';
        convertFiles = [];
        renderConvertList();
    }

    async function convertPDFs() {
        if (convertFiles.length === 0) return;

        progressContainer.classList.remove('d-none');
        progressBar.style.width = '0%';
        convertBtn.disabled = true;

        const imageFormat = document.querySelector('input[name="imageFormat"]:checked').value;
        const downloadOption = document.querySelector('input[name="downloadOption"]:checked').value;

        const zip = new JSZip();
        let processedFiles = 0;
        let totalPages = 0;

        for (let file of convertFiles) {
            const pdfData = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
            totalPages += pdf.numPages;
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const scale = 1.5;
                const viewport = page.getViewport({scale});
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({canvasContext: context, viewport}).promise;
                
                const imgData = canvas.toDataURL(`image/${imageFormat}`);
                const fileName = `${file.name.replace('.pdf', '')}_page_${i}.${imageFormat}`;

                if (downloadOption === 'zip') {
                    zip.file(fileName, imgData.split(',')[1], {base64: true});
                } else {
                    const blob = await (await fetch(imgData)).blob();
                    saveAs(blob, fileName);
                }

                updateProgress(++processedFiles / totalPages * 100);
            }
        }

        if (downloadOption === 'zip') {
            const content = await zip.generateAsync({type: 'blob'});
            saveAs(content, `pdf_images.zip`);
        }

        convertBtn.disabled = false;
        progressContainer.classList.add('d-none');
    }

    function updateProgress(percentage) {
        progressBar.style.width = `${percentage}%`;
        progressBar.textContent = `${Math.round(percentage)}%`;
    }
};
