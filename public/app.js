const slotNames = ["天鹅拉花", "爱心拉花", "郁金香拉花", "树叶拉花", "小熊拉花", "玫瑰拉花", "海马拉花", "蝴蝶拉花"];
const wheel = document.querySelector("#wheel");
const slotList = document.querySelector("#slotList");
const spinButton = document.querySelector("#spinButton");
const shuffleButton = document.querySelector("#shuffleButton");
const resultName = document.querySelector("#resultName");
const backendToggle = document.querySelector("#backendToggle");
const backendClose = document.querySelector("#backendClose");
const backendPanel = document.querySelector("#backendPanel");
let slots = [];
let currentRotation = 0;
let activeIndex = -1;
let resizeFrame = 0;

function defaultSlots() {
  return slotNames.map((name, index) => {
    const id = index + 1;
    return {
      id,
      name: localStorage.getItem(`coffee_slot_${id}_name`) || name,
      imageUrl: localStorage.getItem(`coffee_slot_${id}_image`) || `./uploads/slot-${id}.svg`,
      uploadKey: `slot_${id}_image`
    };
  });
}

function loadSlots() {
  slots = defaultSlots();
  renderWheel();
  renderSlotList();
}

function renderWheel() {
  wheel.innerHTML = "";
  slots.forEach((slot, index) => {
    const marker = document.createElement("div");
    marker.className = "slot-marker";
    const segmentAngle = 360 / slots.length;
    marker.dataset.angle = String(index * segmentAngle + segmentAngle / 2);

    const img = document.createElement("img");
    img.className = "slot-image";
    img.src = slot.imageUrl;
    img.alt = `${slot.name} 图片`;

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
  const radiusRatio = wheel.clientWidth <= 420 ? 0.34 : 0.33;
  const radius = Math.max(104, Math.round(wheel.clientWidth * radiusRatio));
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
    img.src = slot.imageUrl;
    img.alt = `${slot.name} 预览`;

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
      if (event.key === "Enter") renameSlot(slot.id, nameInput.value);
    });

    const upload = document.createElement("label");
    upload.className = "upload-button";
    upload.title = `上传 ${slot.name} 图片`;
    upload.textContent = "图片";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
    input.addEventListener("change", event => saveImage(slot.id, event.target.files[0]));

    upload.append(input);
    row.append(img, editor, save, upload);
    slotList.append(row);
  });
}

function renameSlot(id, name) {
  const nextName = String(name || "").trim();
  if (!nextName) {
    alert("名称不能为空");
    return;
  }
  localStorage.setItem(`coffee_slot_${id}_name`, nextName);
  loadSlots();
}

function saveImage(id, file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("请上传图片文件");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      localStorage.setItem(`coffee_slot_${id}_image`, String(reader.result));
      loadSlots();
    } catch (error) {
      alert("图片太大了，请换一张小一点的图。");
    }
  };
  reader.readAsDataURL(file);
}

function updateResult(index) {
  activeIndex = index;
  resultName.textContent = slots[index].name;
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

function setBackendOpen(isOpen) {
  backendPanel.classList.toggle("is-open", isOpen);
  backendPanel.setAttribute("aria-hidden", String(!isOpen));
  backendToggle.setAttribute("aria-expanded", String(isOpen));
}

spinButton.addEventListener("click", () => spinTo());
shuffleButton.addEventListener("click", () => {
  const next = activeIndex === -1 ? 0 : (activeIndex + 1) % slots.length;
  spinTo(next);
});
backendToggle.addEventListener("click", () => setBackendOpen(!backendPanel.classList.contains("is-open")));
backendClose.addEventListener("click", () => setBackendOpen(false));
window.addEventListener("resize", () => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(updateSlotRadius);
});
loadSlots();
