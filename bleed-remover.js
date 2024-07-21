document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('pdf-upload');
    const fileSelect = document.getElementById('file-select');
    const fileInfo = document.getElementById('file-info');
    const processButton = document.getElementById('remove-bleed-lines');
    const processingSection = document.getElementById('processing');
    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.querySelector('.progress');
    const downloadSection = document.getElementById('download');
    const downloadLink = document.getElementById('download-link');

    let pdfFile = null;

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
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                pdfFile = file;
                fileInfo.textContent = `File selected: ${file.name}`;
                fileInfo.classList.remove('d-none');
                processingSection.classList.remove('d-none');
            } else {
                alert('Please select a PDF file.');
            }
        }
    }

    processButton.addEventListener('click', async () => {
        if (!pdfFile) {
            alert('Please select a PDF file first.');
            return;
        }

        processButton.disabled = true;
        progressContainer.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';

        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            const totalPages = pdfDoc.getPageCount();

            for (let i = 0; i < totalPages; i++) {
                const page = pdfDoc.getPage(i);
                const { width, height } = page.getSize();
                const bleedMargin = 18; // 1/8 inch at 144 DPI

                page.setCropBox(
                    bleedMargin,
                    bleedMargin,
                    width - 2 * bleedMargin,
                    height - 2 * bleedMargin
                );

                // Update progress
                const progress = Math.round(((i + 1) / totalPages) * 100);
                progressBar.style.width = `${progress}%`;
                progressBar.textContent = `${progress}%`;
                progressBar.setAttribute('aria-valuenow', progress);
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            downloadLink.href = url;
            downloadLink.download = `processed_${pdfFile.name}`;
            downloadSection.classList.remove('d-none');

        } catch (error) {
            console.error('Error processing PDF:', error);
            alert('An error occurred while processing the PDF. Please try again.');
        } finally {
            processButton.disabled = false;
        }
    });
});
