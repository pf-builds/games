// Scaffold placeholder. M1 replaces this.
(function () {
  const c = document.getElementById('game'), g = c.getContext('2d');
  function draw() {
    const d = devicePixelRatio || 1;
    c.width = innerWidth * d; c.height = innerHeight * d;
    g.fillStyle = '#1d1a24'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#f3ead8'; g.font = `${24 * d}px system-ui`; g.textAlign = 'center';
    g.fillText("Sapper's Path: scaffold", c.width / 2, c.height / 2);
  }
  addEventListener('resize', draw); draw();
})();
