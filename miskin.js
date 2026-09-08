const form = document.querySelector("#letterForm");
const status = document.querySelector("#saveStatus");
const printButton = document.querySelector("#printButton");
const resetButton = document.querySelector("#resetButton");
const storageKey = "suratku-keterangan-miskin-v1";
const placeholders = {
  kabupaten: "{{kabupaten}}",
  kabupatenKop: "{{kabupaten}}",
  kecamatan: "{{kecamatan}}",
  kecamatanKop: "{{kecamatan}}",
  desaKelurahan: "{{desa/kelurahan}}",
  desaKelurahanKop: "{{desa/kelurahan}}",
  namaKepalaDesa: "{{nama kepala desa}}",
  tanggalHariIni: "{{tanggal hari ini}}",
  nama: "{{nama}}",
  pekerjaan: "{{pekerjaan}}",
  alamat: "{{alamat}}",
  namaPemohon: "{{nama pemohon}}",
  nik: "{{nik}}",
  tempatLahir: "{{tempat lahir}}",
  tanggalLahir: "{{tanggal lahir}}",
  pekerjaanOrtu: "{{pekerjaan Orang tua}}",
  agama: "{{agama}}",
  alamatOrtu: "{{alamat orang tua}}",
  penghasilan: "{{penghasilan}}",
  tanggungan: "{{tanggungan}}",
};

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function values() {
  return Object.fromEntries(new FormData(form).entries());
}

function titleCase(value) {
  return String(value || "")
    .toLocaleLowerCase("id-ID")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("id-ID"));
}

function updatePreview() {
  const data = values();
  document.querySelectorAll("[data-output]").forEach((node) => {
    const key = node.dataset.output;
    const sourceKey = key.replace(/Kop$/, "");
    const value = key.endsWith("Kop")
      ? String(data[sourceKey] || "").toLocaleUpperCase("id-ID")
      : ["kabupaten", "kecamatan", "desaKelurahan"].includes(key)
        ? titleCase(data[key])
        : key.includes("tanggal")
          ? formatDate(data[key])
          : data[key];
    node.textContent = value?.trim() || placeholders[key];
  });
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(values()));
  status.textContent = `Tersimpan otomatis • ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return;
    Object.entries(saved).forEach(([name, value]) => {
      if (form.elements[name]) form.elements[name].value = value;
    });
    status.textContent = "Data terakhir dimuat dari perangkat ini";
  } catch {
    localStorage.removeItem(storageKey);
  }
}

let timer;
form.addEventListener("input", () => {
  updatePreview();
  clearTimeout(timer);
  timer = setTimeout(save, 350);
});
printButton.addEventListener("click", () => {
  if (!form.reportValidity()) return;
  save();
  window.print();
});
resetButton.addEventListener("click", () => {
  if (!confirm("Kosongkan semua data pada formulir ini?")) return;
  form.reset();
  localStorage.removeItem(storageKey);
  status.textContent = "Formulir dikosongkan";
  updatePreview();
});
restore();
updatePreview();
