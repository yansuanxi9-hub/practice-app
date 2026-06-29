(function () {
  var reader = null;

  if (typeof pdfjsLib !== "undefined") {
    reader = pdfjsLib;
  } else if (typeof window !== "undefined" && window.pdfjsLib) {
    reader = window.pdfjsLib;
  }

  if (reader && reader.GlobalWorkerOptions) {
    reader.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";
  }

  if (typeof window !== "undefined") {
    window.PracticePDFReader = reader;
    document.documentElement.dataset.pdfjs = reader ? "ready" : "missing";
  }
})();
