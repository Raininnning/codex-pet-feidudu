(function (root) {
  function measure(pixels, width, height) {
    let left = width, top = height, right = -1, bottom = -1;
    let mass = 0, momentX = 0, momentY = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      mass += alpha; momentX += alpha * x; momentY += alpha * y;
      if (alpha <= 128) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (!mass || right < left) throw new Error('动画帧没有可见角色');
    return { left, top, right, bottom, height: bottom - top + 1,
      centerX: momentX / mass, centerY: momentY / mass };
  }
  function fit(metrics, target) {
    const scale = target.height / metrics.height;
    // 使用像素中心坐标，避免不同缩放率带来半像素偏移。
    return { scale, x: target.centerX + 0.5 - (metrics.centerX + 0.5) * scale,
      y: target.centerY + 0.5 - (metrics.centerY + 0.5) * scale };
  }
  const api = { measure, fit };
  if (typeof module !== 'undefined') module.exports = api;
  else root.PetFrameAlignment = api;
})(globalThis);
