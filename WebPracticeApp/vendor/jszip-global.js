(function () {
  var zipReader = null;

  if (typeof JSZip !== "undefined") {
    zipReader = JSZip;
  } else if (typeof window !== "undefined" && window.JSZip) {
    zipReader = window.JSZip;
  } else if (typeof self !== "undefined" && self.JSZip) {
    zipReader = self.JSZip;
  }

  if (typeof window !== "undefined") {
    window.PracticeZipReader = zipReader;
    document.documentElement.dataset.jszip = zipReader ? "ready" : "missing";
  }
})();
