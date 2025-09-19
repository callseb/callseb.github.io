(function () {
  const TEX = "https://threejs.org/examples/textures/planets";

  // Create or find a canvas so we always have a render target
  function getOrCreateCanvas() {
    let canvas =
      document.getElementById("solar-scene") ||
      document.getElementById("scene"); // fallback to your old id if you had one
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "solar-scene";
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      document.body.appendChild(canvas);
    }
    return canvas;
  }

  // ----- curved-label sprite -----
  function makeCurvedLabel(text, diameterPx = 180) {
    const pad = 24;
    const size = diameterPx + pad * 2;
    const cvs = document.createElement("canvas");
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    const radius = diameterPx / 2;
    const chars = [...text];
    const fontSize = 26;
    ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "#e9ffd0";
    ctx.shadowColor = "rgba(180,255,120,.28)";
    ctx.shadowBlur = 8;
    ctx.textBaseline = "
