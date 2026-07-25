(function networkBackground(opts) {
  const cfg = Object.assign({
    color: 'rgba(220,220,220,1)',
    glowColor: 'rgba(220,220,220,0.55)',
    maxConnDist: 165,
    speed: [10, 24],
    radius: [1, 2],
    life: [12, 28],
    density: 0.000085,
    fadeIn: 0.18,
    fadeOut: 0.22,
    attractRadius: 140,
    attractStrength: 90,
    minSpawnDist: 32,
    spawnAttempts: 6,
    spawnAttemptsFirst: 2,
    linkAlphaMin: 0.14
  }, opts || {});

  const canvas = document.getElementById('bg-net');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const spawn = { edgeBias: 0.45, centerBias: 0.2, margin: 40, centerBox: 0.4 };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = navigator.connection && navigator.connection.saveData;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const densityScale = (saveData ? 0.6 : 1) * (isMobile ? 0.85 : 1) * (reduce.matches ? 0.7 : 1);
  const cursor = { x: 0, y: 0, active: false };

  let width = 0;
  let height = 0;
  let nodes = [];
  let running = true;
  let lastTime = 0;

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const ease = value => value * value * (3 - 2 * value);
  const minDistanceSquared = cfg.minSpawnDist * cfg.minSpawnDist;

  function tooClose(x, y) {
    return nodes.some(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return dx * dx + dy * dy < minDistanceSquared;
    });
  }

  class Node {
    constructor() {
      this.reset(true);
    }

    reset(firstGeneration) {
      const speed = rand(cfg.speed[0], cfg.speed[1]);
      let life = rand(cfg.life[0], cfg.life[1]);
      const attempts = firstGeneration ? cfg.spawnAttemptsFirst : cfg.spawnAttempts;
      let edgeSpawn = false;
      let x = 0;
      let y = 0;
      let angle = 0;

      for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
        const choice = Math.random();
        edgeSpawn = false;

        if (!firstGeneration && choice < spawn.edgeBias) {
          edgeSpawn = true;
          const fromLeft = Math.random() < 0.5;
          x = fromLeft ? -spawn.margin : width + spawn.margin;
          y = rand(0, height);
          angle = fromLeft ? rand(-Math.PI / 3, Math.PI / 3) : rand(2 * Math.PI / 3, 4 * Math.PI / 3);
        } else if (!firstGeneration && choice < spawn.edgeBias + spawn.centerBias) {
          const boxWidth = width * spawn.centerBox;
          const boxHeight = height * spawn.centerBox;
          x = rand((width - boxWidth) / 2, (width + boxWidth) / 2);
          y = rand((height - boxHeight) / 2, (height + boxHeight) / 2);
          angle = rand(0, Math.PI * 2);
        } else {
          x = rand(0, width);
          y = rand(0, height);
          angle = rand(0, Math.PI * 2);
        }

        if (!tooClose(x, y)) break;
      }

      if (edgeSpawn) {
        const distanceToCenter = (width - width * spawn.centerBox) / 2 + spawn.margin;
        life = Math.max(life, distanceToCenter / Math.max(0.000001, speed * 0.5) + 3);
      }

      this.x = x;
      this.y = y;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.radius = rand(cfg.radius[0], cfg.radius[1]);
      this.life = life;
      this.time = firstGeneration ? rand(0, life) : rand(0, cfg.fadeIn * life * 0.3);
    }

    update(delta) {
      this.time += delta;
      if (this.time >= this.life) {
        this.reset(false);
        return;
      }

      if (cursor.active && !reduce.matches) {
        const dx = cursor.x - this.x;
        const dy = cursor.y - this.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > 0 && distanceSquared < cfg.attractRadius * cfg.attractRadius) {
          const distance = Math.sqrt(distanceSquared);
          const force = cfg.attractStrength * (1 - distance / cfg.attractRadius);
          this.vx += (dx / distance) * force * delta;
          this.vy += (dy / distance) * force * delta;
          const velocity = Math.hypot(this.vx, this.vy);
          const maxVelocity = Math.max(cfg.speed[1] * 1.8, 40);
          if (velocity > maxVelocity) {
            const scale = maxVelocity / velocity;
            this.vx *= scale;
            this.vy *= scale;
          }
        }
      }

      this.x += this.vx * delta;
      this.y += this.vy * delta;
      const margin = 40;
      if (this.x < -margin) this.x = width + margin;
      if (this.x > width + margin) this.x = -margin;
      if (this.y < -margin) this.y = height + margin;
      if (this.y > height + margin) this.y = -margin;
    }

    alpha() {
      const progress = this.time / this.life;
      const fadeIn = Math.max(0.001, cfg.fadeIn);
      const fadeOut = Math.max(0.001, cfg.fadeOut);
      const fadeInAlpha = progress < fadeIn ? ease(progress / fadeIn) : 1;
      const fadeOutAlpha = progress > 1 - fadeOut ? ease((1 - progress) / fadeOut) : 1;
      return Math.min(fadeInAlpha, fadeOutAlpha);
    }

    draw() {
      const alpha = this.alpha();
      if (alpha <= 0) return;

      const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 6);
      glow.addColorStop(0, `rgba(220,220,220,${(0.6 * alpha).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = cfg.color;
      ctx.globalAlpha = 0.65 * alpha;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.round(width * height * cfg.density * densityScale);
    while (nodes.length < target) nodes.push(new Node());
    while (nodes.length > target) nodes.pop();
  }

  function buildGrid() {
    const cellSize = cfg.maxConnDist;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const cells = Array.from({ length: cols * rows }, () => []);
    nodes.forEach((node, index) => {
      const x = Math.floor(clamp(node.x, 0, width - 1) / cellSize);
      const y = Math.floor(clamp(node.y, 0, height - 1) / cellSize);
      cells[y * cols + x].push(index);
    });
    return { cells, cols, rows };
  }

  function draw(timeStamp) {
    if (!running) return;
    const now = timeStamp * 0.001;
    const delta = Math.min(0.033, lastTime ? now - lastTime : 0.016);
    lastTime = now;
    nodes.forEach(node => node.update(delta));
    ctx.clearRect(0, 0, width, height);

    const maxDistanceSquared = cfg.maxConnDist * cfg.maxConnDist;
    const { cells, cols, rows } = buildGrid();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';

    for (let cellY = 0; cellY < rows; cellY += 1) {
      for (let cellX = 0; cellX < cols; cellX += 1) {
        const bucket = cells[cellY * cols + cellX];
        if (!bucket.length) continue;
        const neighbors = [[cellX, cellY], [cellX + 1, cellY], [cellX, cellY + 1], [cellX + 1, cellY + 1], [cellX - 1, cellY + 1]];

        neighbors.forEach(([neighborX, neighborY]) => {
          if (neighborX < 0 || neighborY < 0 || neighborX >= cols || neighborY >= rows) return;
          const neighborBucket = cells[neighborY * cols + neighborX];
          bucket.forEach((nodeIndex, bucketIndex) => {
            const nodeA = nodes[nodeIndex];
            const alphaA = nodeA.alpha();
            if (alphaA < cfg.linkAlphaMin) return;

            const start = neighborX === cellX && neighborY === cellY ? bucketIndex + 1 : 0;
            for (let index = start; index < neighborBucket.length; index += 1) {
              const nodeB = nodes[neighborBucket[index]];
              const alphaB = nodeB.alpha();
              if (alphaB < cfg.linkAlphaMin) continue;
              const dx = nodeA.x - nodeB.x;
              const dy = nodeA.y - nodeB.y;
              const distanceSquared = dx * dx + dy * dy;
              if (distanceSquared > maxDistanceSquared) continue;

              const closeness = 1 - Math.sqrt(distanceSquared) / cfg.maxConnDist;
              ctx.strokeStyle = cfg.color;
              ctx.globalAlpha = Math.pow(closeness, 1.5) * 0.375 * (alphaA + alphaB);
              ctx.lineWidth = 1 + 1.2 * closeness;
              ctx.beginPath();
              ctx.moveTo(nodeA.x, nodeA.y);
              ctx.lineTo(nodeB.x, nodeB.y);
              ctx.stroke();
            }
          });
        });
      }
    }

    ctx.globalAlpha = 1;
    nodes.forEach(node => node.draw());
    if (!reduce.matches) requestAnimationFrame(draw);
  }

  addEventListener('pointermove', event => {
    cursor.x = event.clientX;
    cursor.y = event.clientY;
    cursor.active = true;
  }, { passive: true });
  addEventListener('pointerleave', () => { cursor.active = false; }, { passive: true });
  addEventListener('touchstart', event => {
    const touch = event.touches[0];
    if (touch) Object.assign(cursor, { x: touch.clientX, y: touch.clientY, active: true });
  }, { passive: true });
  addEventListener('touchmove', event => {
    const touch = event.touches[0];
    if (touch) Object.assign(cursor, { x: touch.clientX, y: touch.clientY });
  }, { passive: true });
  addEventListener('touchend', () => { cursor.active = false; }, { passive: true });
  addEventListener('touchcancel', () => { cursor.active = false; }, { passive: true });
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      lastTime = 0;
      requestAnimationFrame(draw);
    }
  });
  reduce.addEventListener?.('change', event => {
    running = !event.matches;
    lastTime = 0;
    if (event.matches) draw(performance.now());
    else requestAnimationFrame(draw);
  });

  resize();
  requestAnimationFrame(draw);
})();