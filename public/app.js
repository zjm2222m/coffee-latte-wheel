const slotNames = [
  "鹦鹉拉花",
  "向日葵拉花",
  "小狗拉花",
  "小猫拉花",
  "熊猫拉花",
  "玫瑰拉花",
  "飞马拉花",
  "骆驼拉花"
];

const wheel = document.querySelector("#wheel");
const slotList = document.querySelector("#slotList");
const spinButton = document.querySelector("#spinButton");
const shuffleButton = document.querySelector("#shuffleButton");
const resultName = document.querySelector("#resultName");
const resultImage = document.querySelector("#resultImage");
const backendToggle = document.querySelector("#backendToggle");
const backendClose = document.querySelector("#backendClose");
const backendPanel = document.querySelector("#backendPanel");
const imageCropper = document.querySelector("#imageCropper");
const cropCanvas = document.querySelector("#cropCanvas");
const cropZoom = document.querySelector("#cropZoom");
const cropTitle = document.querySelector("#cropTitle");
const cropClose = document.querySelector("#cropClose");
const cropCancel = document.querySelector("#cropCancel");
const cropReset = document.querySelector("#cropReset");
const cropSave = document.querySelector("#cropSave");
const filePreviewMode = window.location.protocol === "file:";
const hasBackend = ["127.0.0.1", "localhost"].includes(window.location.hostname);
const cropImageTypes = ["image/png", "image/jpeg", "image/webp"];
const backendPassword = "987654321";

let slots = [];
let currentRotation = 0;
let activeIndex = -1;
let resizeFrame = 0;
let resultEffectTimer = 0;

const cropState = {
  slotId: null,
  fileInput: null,
  image: null,
  objectUrl: "",
  scale: 1,
  minScale: 1,
  x: 0,
  y: 0,
  dragStartX: 0,
  dragStartY: 0,
  startX: 0,
  startY: 0,
  isDragging: false,
  lastFocusedElement: null
};

function defaultSlots() {
  return slotNames.map((name, index) => {
    const id = index + 1;
    return {
      id,
      name: localStorage.getItem(`coffee_slot_${id}_name`) || name,
      imageUrl: localStorage.getItem(`coffee_slot_${id}_image`) || `./uploads/slot-${id}.jpg`,
      uploadKey: `slot_${id}_image`
    };
  });
}

function placeholderSvg(slot) {
  const colors = [
    ["#2B1A12", "#F3E7D3"],
    ["#6B3F2A", "#FFF8EC"],
    ["#4FAE8A", "#FFF8EC"],
    ["#B94A5A", "#FFF8EC"],
    ["#D7D2C8", "#2B1A12"],
    ["#8A5B3C", "#FFF8EC"],
    ["#305A4A", "#FFF8EC"],
    ["#C8845D", "#2B1A12"],
    ["#463025", "#F3E7D3"],
    ["#F3E7D3", "#2B1A12"]
  ][slot.id - 1];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="80" fill="${colors[0]}"/>
      <circle cx="80" cy="82" r="48" fill="${colors[1]}" opacity="0.95"/>
      <circle cx="80" cy="82" r="36" fill="none" stroke="${colors[0]}" stroke-width="8" opacity="0.9"/>
      <path d="M80 106C42 78 57 44 80 64c23-20 38 14 0 42Z" fill="none" stroke="${colors[0]}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M80 104V62" fill="none" stroke="${colors[0]}" stroke-width="6" stroke-linecap="round" opacity="0.65"/>
      <text x="80" y="143" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="800" fill="${colors[1]}">拉花 ${slot.id}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function imageFor(slot) {
  return slot.imageUrl || placeholderSvg(slot);
}

function attachSlotImageFallback(img, slot) {
  let triedSvgFallback = false;
  img.addEventListener("error", () => {
    if (!triedSvgFallback && !String(img.src).includes(`slot-${slot.id}.svg`)) {
      triedSvgFallback = true;
      img.src = `./uploads/slot-${slot.id}.svg`;
      return;
    }

    img.src = placeholderSvg(slot);
  });
}

async function loadSlots() {
  if (filePreviewMode || !hasBackend) {
    slots = defaultSlots();
  } else {
    try {
      const response = await fetch("/api/slots");
      const data = await response.json();
      slots = data.slots.slice(0, slotNames.length);
    } catch (error) {
      slots = defaultSlots();
    }
  }

  renderWheel();
  renderSlotList();

  if (slots.length && activeIndex === -1) {
    resultImage.src = imageFor(slots[0]);
    resultImage.alt = `${slots[0].name} 结果图`;
  } else if (slots[activeIndex]) {
    resultImage.src = imageFor(slots[activeIndex]);
    resultImage.alt = `${slots[activeIndex].name} 结果图`;
  }
}

function renderWheel() {
  wheel.innerHTML = "";

  slots.forEach((slot, index) => {
    const marker = document.createElement("div");
    marker.className = "slot-marker";
    const segmentAngle = 360 / slots.length;
    const angle = index * segmentAngle + segmentAngle / 2;
    marker.dataset.angle = String(angle);

    const img = document.createElement("img");
    img.className = "slot-image";
    img.src = imageFor(slot);
    img.alt = `${slot.name} 图片`;
    attachSlotImageFallback(img, slot);

    const label = document.createElement("span");
    label.className = "slot-label";
    label.textContent = slot.name;

    const content = document.createElement("div");
    content.className = "slot-content";
    content.append(img, label);

    marker.append(content);
    wheel.append(marker);
  });

  updateSlotRadius();
}

function updateSlotRadius() {
  const width = wheel.clientWidth;
  const height = wheel.clientHeight;
  const baseSize = Math.min(width, height);

  let radiusRatio = 0.328;
  let minRadius = 86;

  if (baseSize <= 302) {
    radiusRatio = 0.3;
    minRadius = 78;
  } else if (baseSize <= 334) {
    radiusRatio = 0.314;
    minRadius = 82;
  }

  const radius = Math.max(minRadius, Math.round(baseSize * radiusRatio));
  for (const marker of document.querySelectorAll(".slot-marker")) {
    const angle = Number(marker.dataset.angle || 0) * Math.PI / 180;
    marker.style.setProperty("--x", `${Math.sin(angle) * radius}px`);
    marker.style.setProperty("--y", `${-Math.cos(angle) * radius}px`);
  }
}

function renderSlotList() {
  slotList.innerHTML = "";

  slots.forEach(slot => {
    const row = document.createElement("div");
    row.className = "slot-row";

    const img = document.createElement("img");
    img.src = imageFor(slot);
    img.alt = `${slot.name} 预览`;
    attachSlotImageFallback(img, slot);

    const editor = document.createElement("div");
    editor.className = "slot-editor";

    const nameInput = document.createElement("input");
    nameInput.className = "slot-name-input";
    nameInput.type = "text";
    nameInput.maxLength = 20;
    nameInput.value = slot.name;
    nameInput.ariaLabel = `修改第 ${slot.id} 个咖啡拉花名称`;

    const key = document.createElement("span");
    key.textContent = `第 ${slot.id} 个 · ${slot.uploadKey}`;
    editor.append(nameInput, key);

    const save = document.createElement("button");
    save.className = "save-button";
    save.type = "button";
    save.textContent = "保存";
    save.addEventListener("click", () => renameSlot(slot.id, nameInput.value));
    nameInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        renameSlot(slot.id, nameInput.value);
      }
    });

    const upload = document.createElement("label");
    upload.className = "upload-button";
    upload.title = `上传 ${slot.name} 图片`;
    upload.textContent = "图片";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.addEventListener("change", event => handleSlotImageSelected(slot.id, event.target.files[0], input));

    upload.append(input);
    row.append(img, editor, save, upload);
    slotList.append(row);
  });
}

async function renameSlot(id, name) {
  const nextName = String(name || "").trim();
  if (!nextName) {
    alert("名称不能为空");
    return;
  }

  if (filePreviewMode || !hasBackend) {
    localStorage.setItem(`coffee_slot_${id}_name`, nextName);
    await loadSlots();
    return;
  }

  const response = await fetch(`/api/slots/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: nextName })
  });

  const payload = await response.json();
  if (!response.ok) {
    alert(payload.error || "保存失败");
    return;
  }

  await loadSlots();
}

function isSupportedCropImage(file) {
  return Boolean(file && cropImageTypes.includes(file.type));
}

function handleSlotImageSelected(id, file, input) {
  if (!file) return;

  if (!isSupportedCropImage(file)) {
    alert("请上传 PNG、JPG 或 WebP 图片。SVG 暂不支持裁剪。");
    input.value = "";
    return;
  }

  openImageCropper(id, file, input);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片无法读取，请换一张图片。"));
    };
    image.src = objectUrl;
  });
}

async function openImageCropper(id, file, input) {
  try {
    closeImageCropper(false);
    cropState.slotId = id;
    cropState.fileInput = input;
    cropState.lastFocusedElement = document.activeElement;
    cropTitle.textContent = `调整 ${slots[id - 1]?.name || "图片"}`;

    const { image, objectUrl } = await loadImageFromFile(file);
    cropState.image = image;
    cropState.objectUrl = objectUrl;

    imageCropper.classList.add("is-open");
    imageCropper.setAttribute("aria-hidden", "false");
    initializeCrop(image);
    cropCanvas.focus();
  } catch (error) {
    alert(error.message || "图片无法读取，请换一张图片。");
    input.value = "";
  }
}

function closeImageCropper(restoreFocus = true) {
  imageCropper.classList.remove("is-open");
  imageCropper.setAttribute("aria-hidden", "true");

  if (cropState.objectUrl) {
    URL.revokeObjectURL(cropState.objectUrl);
  }
  if (cropState.fileInput) {
    cropState.fileInput.value = "";
  }

  const lastFocusedElement = cropState.lastFocusedElement;
  cropState.slotId = null;
  cropState.fileInput = null;
  cropState.image = null;
  cropState.objectUrl = "";
  cropState.scale = 1;
  cropState.minScale = 1;
  cropState.x = 0;
  cropState.y = 0;
  cropState.isDragging = false;
  cropZoom.value = "1";

  const ctx = cropCanvas.getContext("2d");
  ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);

  if (restoreFocus && lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
  cropState.lastFocusedElement = null;
}

function getCropCanvasSize() {
  return Math.max(220, Math.round(cropCanvas.getBoundingClientRect().width || 320));
}

function initializeCrop(image) {
  const size = getCropCanvasSize();
  const minScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);

  cropState.minScale = minScale;
  cropState.scale = minScale;
  cropState.x = (size - image.naturalWidth * minScale) / 2;
  cropState.y = (size - image.naturalHeight * minScale) / 2;
  cropZoom.value = "1";

  clampCropPosition();
  drawCropPreview();
}

function clampCropPosition() {
  if (!cropState.image) return;

  const size = getCropCanvasSize();
  const imageWidth = cropState.image.naturalWidth * cropState.scale;
  const imageHeight = cropState.image.naturalHeight * cropState.scale;

  if (imageWidth <= size) {
    cropState.x = (size - imageWidth) / 2;
  } else {
    cropState.x = Math.min(0, Math.max(size - imageWidth, cropState.x));
  }

  if (imageHeight <= size) {
    cropState.y = (size - imageHeight) / 2;
  } else {
    cropState.y = Math.min(0, Math.max(size - imageHeight, cropState.y));
  }
}

function drawCropPreview() {
  if (!cropState.image) return;

  const size = getCropCanvasSize();
  const dpr = window.devicePixelRatio || 1;
  cropCanvas.width = Math.round(size * dpr);
  cropCanvas.height = Math.round(size * dpr);

  const ctx = cropCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#f3e7d3";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(
    cropState.image,
    cropState.x,
    cropState.y,
    cropState.image.naturalWidth * cropState.scale,
    cropState.image.naturalHeight * cropState.scale
  );
}

function setCropZoom(multiplier) {
  if (!cropState.image) return;

  const size = getCropCanvasSize();
  const previousScale = cropState.scale;
  const nextScale = cropState.minScale * Number(multiplier || 1);
  const centerX = size / 2;
  const centerY = size / 2;

  cropState.x = centerX - ((centerX - cropState.x) / previousScale) * nextScale;
  cropState.y = centerY - ((centerY - cropState.y) / previousScale) * nextScale;
  cropState.scale = nextScale;

  clampCropPosition();
  drawCropPreview();
}

function resetCropPosition() {
  if (cropState.image) {
    initializeCrop(cropState.image);
  }
}

function exportCropDataUrl() {
  const outputSize = 720;
  const previewSize = getCropCanvasSize();
  const ratio = outputSize / previewSize;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f3e7d3";
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.drawImage(
    cropState.image,
    cropState.x * ratio,
    cropState.y * ratio,
    cropState.image.naturalWidth * cropState.scale * ratio,
    cropState.image.naturalHeight * cropState.scale * ratio
  );

  return canvas.toDataURL("image/jpeg", 0.9);
}

async function saveSlotImageDataUrl(id, dataUrl) {
  if (filePreviewMode || !hasBackend) {
    try {
      localStorage.setItem(`coffee_slot_${id}_image`, dataUrl);
    } catch (error) {
      alert("本地预览存储空间不足，请换一张更小的图片或使用服务器模式。");
      return false;
    }
    await loadSlots();
    return true;
  }

  const response = await fetch(`/api/slots/${id}/image`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      key: `slot_${id}_image`,
      dataUrl
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    alert(payload.error || "上传失败");
    return false;
  }

  await loadSlots();
  return true;
}

async function saveCroppedImage() {
  if (!cropState.image || !cropState.slotId) return;

  const dataUrl = exportCropDataUrl();
  cropSave.disabled = true;
  cropSave.textContent = "保存中…";

  try {
    const ok = await saveSlotImageDataUrl(cropState.slotId, dataUrl);
    if (ok) {
      closeImageCropper();
    }
  } finally {
    cropSave.disabled = false;
    cropSave.textContent = "保存图片";
  }
}

function triggerResultEffect() {
  const panel = resultName.closest(".result-panel");
  if (!panel) return;

  panel.classList.remove("is-revealed");
  window.clearTimeout(resultEffectTimer);
  void panel.offsetWidth;
  panel.classList.add("is-revealed");
  resultEffectTimer = window.setTimeout(() => {
    panel.classList.remove("is-revealed");
  }, 760);
}

function updateResult(index) {
  activeIndex = index;
  const slot = slots[index];
  resultName.textContent = `恭喜您抽到 ${slot.name}啦`;
  resultImage.src = imageFor(slot);
  resultImage.alt = `${slot.name} 结果图`;
  triggerResultEffect();
}

function spinTo(index = Math.floor(Math.random() * slots.length)) {
  spinButton.disabled = true;

  const segmentAngle = 360 / slots.length;
  const pointerAngle = 180;
  const segmentCenter = index * segmentAngle + segmentAngle / 2;
  const currentAngle = ((currentRotation % 360) + 360) % 360;
  const targetAngle = ((pointerAngle - segmentCenter) % 360 + 360) % 360;
  const spinDelta = (targetAngle - currentAngle + 360) % 360;

  currentRotation += 360 * 4 + spinDelta;
  wheel.style.setProperty("--wheel-rotation", `${currentRotation}deg`);
  wheel.style.transform = `rotate(${currentRotation}deg)`;

  window.setTimeout(() => {
    updateResult(index);
    spinButton.disabled = false;
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 260 : 2350);
}

function isBackendUnlocked() {
  return sessionStorage.getItem("coffee_backend_unlocked") === "true";
}

function unlockBackend() {
  if (isBackendUnlocked()) {
    return true;
  }

  const password = window.prompt("请输入后台管理密码");
  if (password === backendPassword) {
    sessionStorage.setItem("coffee_backend_unlocked", "true");
    return true;
  }

  if (password !== null) {
    alert("密码错误");
  }
  return false;
}

function setBackendOpen(isOpen) {
  if (isOpen && !unlockBackend()) {
    return;
  }

  backendPanel.classList.toggle("is-open", isOpen);
  backendPanel.setAttribute("aria-hidden", String(!isOpen));
  backendToggle.setAttribute("aria-expanded", String(isOpen));
}

cropCanvas.addEventListener("pointerdown", event => {
  if (!cropState.image) return;

  cropState.isDragging = true;
  cropState.dragStartX = event.clientX;
  cropState.dragStartY = event.clientY;
  cropState.startX = cropState.x;
  cropState.startY = cropState.y;
  cropCanvas.setPointerCapture(event.pointerId);
});

cropCanvas.addEventListener("pointermove", event => {
  if (!cropState.isDragging) return;

  cropState.x = cropState.startX + event.clientX - cropState.dragStartX;
  cropState.y = cropState.startY + event.clientY - cropState.dragStartY;
  clampCropPosition();
  drawCropPreview();
});

function stopCropDrag() {
  cropState.isDragging = false;
}

cropCanvas.addEventListener("pointerup", stopCropDrag);
cropCanvas.addEventListener("pointercancel", stopCropDrag);
cropCanvas.addEventListener("keydown", event => {
  if (!cropState.image) return;

  const zoomStep = 0.08;
  const moveStep = event.shiftKey ? 24 : 8;
  let handled = true;

  if (event.key === "ArrowLeft") {
    cropState.x -= moveStep;
  } else if (event.key === "ArrowRight") {
    cropState.x += moveStep;
  } else if (event.key === "ArrowUp") {
    cropState.y -= moveStep;
  } else if (event.key === "ArrowDown") {
    cropState.y += moveStep;
  } else if (event.key === "+" || event.key === "=") {
    cropZoom.value = String(Math.min(Number(cropZoom.max), Number(cropZoom.value) + zoomStep));
    setCropZoom(cropZoom.value);
    return;
  } else if (event.key === "-") {
    cropZoom.value = String(Math.max(Number(cropZoom.min), Number(cropZoom.value) - zoomStep));
    setCropZoom(cropZoom.value);
    return;
  } else if (event.key === "Escape") {
    closeImageCropper();
    return;
  } else {
    handled = false;
  }

  if (handled) {
    event.preventDefault();
    clampCropPosition();
    drawCropPreview();
  }
});

cropZoom.addEventListener("input", event => setCropZoom(event.target.value));
cropReset.addEventListener("click", resetCropPosition);
cropSave.addEventListener("click", saveCroppedImage);
cropCancel.addEventListener("click", () => closeImageCropper());
cropClose.addEventListener("click", () => closeImageCropper());
imageCropper.addEventListener("click", event => {
  if (event.target.matches("[data-crop-close]")) {
    closeImageCropper();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && imageCropper.classList.contains("is-open")) {
    closeImageCropper();
  }
});

spinButton.addEventListener("click", () => spinTo());
shuffleButton.addEventListener("click", () => {
  const next = activeIndex === -1 ? 0 : (activeIndex + 1) % slots.length;
  spinTo(next);
});
backendToggle.addEventListener("click", () => setBackendOpen(!backendPanel.classList.contains("is-open")));
backendClose.addEventListener("click", () => setBackendOpen(false));

window.addEventListener("resize", () => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    updateSlotRadius();
    if (cropState.image && imageCropper.classList.contains("is-open")) {
      clampCropPosition();
      drawCropPreview();
    }
  });
});

loadSlots();
