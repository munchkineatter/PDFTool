document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const fileSelect = document.getElementById('file-select');
    const fileList = document.getElementById('file-list');
    const convertBtn = document.getElementById('convert-btn');
    const clearBtn = document.getElementById('clear-btn');
    const progressBar = document.querySelector('.progress-bar');
    const progressContainer = document.querySelector('.progress');
    const conversionTypeRadios = document.getElementsByName('conversionType');
    const pdfToImageOptions = document.getElementById('pdfToImageOptions');

    let files = [];

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
        const newFiles = [...dt.files];
        handleFiles(newFiles);
    }

    fileSelect.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles([...e.target.files]);
    });

    function handleFiles(newFiles) {
        files = [...files, ...newFiles];
        updateFileList();
        updateConvertButton();
        updateConversionType();
    }

    function updateFileList() {
        fileList.innerHTML = files.map((file, index) => `
            <div class="file-item">
                <span>${file.name}</span>
                <button class="btn btn-sm btn-danger remove-file" data-index="${index}">Remove</button>
            </div>
        `).join('');

        document.querySelectorAll('.remove-file').forEach(button => {
            button.addEventListener('click', removeFile);
        });
    }

    function removeFile(e) {
        const index = parseInt(e.target.getAttribute('data-index'));
        files.splice(index, 1);
        updateFileList();
        updateConvertButton();
        updateConversionType();
    }

    function updateConvertButton() {
        convertBtn.disabled = files.length === 0;
        clearBtn.disabled = files.length === 0;
    }

    function updateConversionType() {
        const allImages = files.every(file => file.type.startsWith('image/'));
        const conversionType = allImages ? 'imageToPdf' : 'pdfToImage';
        
        document.getElementById(conversionType).checked = true;
        pdfToImageOptions.style.display = conversionType === 'pdfToImage' ? 'block' : 'none';
    }

    clearBtn.addEventListener('click', () => {
        files = [];
        updateFileList();
        updateConvertButton();
        updateConversionType();
    });

    conversionTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            pdfToImageOptions.style.display = radio.value === 'pdfToImage' ? 'block' : 'none';
        });
    });

    convertBtn.addEventListener('click', async () => {
        const selectedConversionType = document.querySelector('input[name="conversionType"]:checked').value;
        
        if (selectedConversionType === 'pdfToImage') {
            await convertPDFToImage();
        } else {
            await convertImageToPDF();
        }
    });

    async function convertPDFToImage() {
        const imageFormat = document.querySelector('input[name="imageFormat"]:checked').value;
        const downloadOption = document.querySelector('input[name="downloadOption"]:checked').value;
        
        progressContainer.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        
        const zip = new JSZip();
        let processedFiles = 0;
        let totalPages = 0;

        for (let file of files) {
            if (file.type !== 'application/pdf') continue;

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

                processedFiles++;
                updateProgress(processedFiles / totalPages * 100);
            }
        }

        if (downloadOption === 'zip') {
            const content = await zip.generateAsync({type: 'blob'});
            saveAs(content, `converted_images.zip`);
        }

        progressContainer.classList.add('d-none');
    }

    async function convertImageToPDF() {
        progressContainer.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';

        const pdfDoc = await PDFLib.PDFDocument.create();
        let processedFiles = 0;

        for (let file of files) {
            if (!file.type.startsWith('image/')) continue;

            const imageData = await file.arrayBuffer();
            let image;
            if (file.type === 'image/jpeg') {
                image = await pdfDoc.embedJpg(imageData);
            } else if (file.type === 'image/png') {
                image = await pdfDoc.embedPng(imageData);
            } else {
                continue;
            }

            const imgWidth = image.width;
            const imgHeight = image.height;
            const isLandscape = imgWidth > imgHeight;

            let pageWidth, pageHeight;
            if (isLandscape) {
                pageWidth = PDFLib.PageSizes.A4[1];
                pageHeight = PDFLib.PageSizes.A4[0];
            } else {
                pageWidth = PDFLib.PageSizes.A4[0];
                pageHeight = PDFLib.PageSizes.A4[1];
            }

            const page = pdfDoc.addPage([pageWidth, pageHeight]);

            const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);

            const x = (pageWidth - imgWidth * scale) / 2;
            const y = (pageHeight - imgHeight * scale) / 2;

            page.drawImage(image, {
                x: x,
                y: y,
                width: imgWidth * scale,
                height: imgHeight * scale,
            });

            processedFiles++;
            updateProgress(processedFiles / files.length * 100);
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, 'converted_images.pdf');

        progressContainer.classList.add('d-none');
    }

    function updateProgress(percentage) {
        progressBar.style.width = `${percentage}%`;
        progressBar.textContent = `${Math.round(percentage)}%`;
    }
});