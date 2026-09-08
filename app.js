const form = document.querySelector('#letterForm');
const status = document.querySelector('#saveStatus');
const printButton = document.querySelector('#printButton');
const resetButton = document.querySelector('#resetButton');
const recapButton = document.querySelector('#recapButton');
const exportButton = document.querySelector('#exportButton');
const storageKey = 'suratku-sptjm-v1';
const recapKey = 'suratku-sptjm-recap-v1';
const placeholders = {
  hari: '............', tanggalAngka: '..............', bulanSurat: '............', tahunTerbilang: 'Dua Ribu Dua Puluh Enam', tanggalRingkas: '.....,.....,2026', tempatSurat: '....................',
  nik: '................................................................', nomorKk: '................................................................',
  nama: '................................................................', tanggalLahir: '................................................................', jenisKelamin: '................................................................',
  alamatKtp: '................................................................', alamatUsaha: '................................................................', nib: '................................................................',
  namaUsaha: '................................................................', bidangUsaha: '................................................................', email: '................................................................', telepon: '................................................................',
  tempatTtd: '....................', tanggalTtd: '....................'
};

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
}

function dayFromDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date(year, month - 1, day));
}

function dateParts(value) {
  if (!value) return {};
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return {
    tanggalAngka: String(day),
    bulanSurat: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(date),
    tahunTerbilang: numberToWords(year),
    tanggalRingkas: `${String(day).padStart(2, '0')},${String(month).padStart(2, '0')},${year}`
  };
}

function numberToWords(number) {
  const ones = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  if (number < 12) return ones[number];
  if (number < 20) return `${numberToWords(number - 10)} Belas`;
  if (number < 100) return `${numberToWords(Math.floor(number / 10))} Puluh${number % 10 ? ` ${numberToWords(number % 10)}` : ''}`;
  if (number < 200) return `Seratus${number % 100 ? ` ${numberToWords(number % 100)}` : ''}`;
  if (number < 1000) return `${numberToWords(Math.floor(number / 100))} Ratus${number % 100 ? ` ${numberToWords(number % 100)}` : ''}`;
  if (number < 2000) return `Seribu${number % 1000 ? ` ${numberToWords(number % 1000)}` : ''}`;
  if (number < 1000000) return `${numberToWords(Math.floor(number / 1000))} Ribu${number % 1000 ? ` ${numberToWords(number % 1000)}` : ''}`;
  return String(number);
}

function values() { return Object.fromEntries(new FormData(form).entries()); }

function updatePreview() {
  const data = values();
  const parts = dateParts(data.tanggalSurat);
  document.querySelectorAll('[data-output]').forEach((node) => {
    const key = node.dataset.output;
    const value = key === 'hari'
      ? dayFromDate(data.tanggalSurat)
      : parts[key] || (key.includes('tanggal') ? formatDate(data[key]) : data[key]);
    node.textContent = value?.trim() || placeholders[key];
  });
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(values()));
  status.textContent = `Tersimpan otomatis • ${new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return;
    Object.entries(saved).forEach(([name, value]) => { if (form.elements[name]) form.elements[name].value = value; });
    status.textContent = 'Data terakhir dimuat dari perangkat ini';
  } catch { localStorage.removeItem(storageKey); }
}

function records() {
  try { return JSON.parse(localStorage.getItem(recapKey)) || []; }
  catch { return []; }
}

function saveRecap() {
  if (!form.reportValidity()) return false;
  const data = values();
  const all = records();
  const now = new Date().toISOString();
  const index = all.findIndex((item) => item.nik === data.nik);
  const record = { ...data, dibuatPada: index >= 0 ? all[index].dibuatPada : now, diperbaruiPada: now };
  if (index >= 0) all[index] = record; else all.push(record);
  localStorage.setItem(recapKey, JSON.stringify(all));
  status.textContent = `Tersimpan di rekap • ${all.length} orang`;
  return true;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function xml(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function columnName(index) {
  let name = '';
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function zip(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const directory = [];
  let offset = 0;
  const push16 = (array, value) => array.push(value & 255, (value >>> 8) & 255);
  const push32 = (array, value) => array.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = encoder.encode(name), data = encoder.encode(text), crc = crc32(data), header = [];
    push32(header, 0x04034b50); push16(header, 20); push16(header, 0); push16(header, 0); push16(header, 0); push16(header, 0); push32(header, crc); push32(header, data.length); push32(header, data.length); push16(header, nameBytes.length); push16(header, 0);
    parts.push(new Uint8Array(header), nameBytes, data);
    directory.push({ nameBytes, crc, size: data.length, offset });
    offset += header.length + nameBytes.length + data.length;
  }
  const directoryOffset = offset;
  for (const entry of directory) {
    const header = [];
    push32(header, 0x02014b50); push16(header, 20); push16(header, 20); push16(header, 0); push16(header, 0); push16(header, 0); push16(header, 0); push32(header, entry.crc); push32(header, entry.size); push32(header, entry.size); push16(header, entry.nameBytes.length); push16(header, 0); push16(header, 0); push16(header, 0); push16(header, 0); push32(header, 0); push32(header, entry.offset);
    parts.push(new Uint8Array(header), entry.nameBytes); offset += header.length + entry.nameBytes.length;
  }
  const end = [];
  push32(end, 0x06054b50); push16(end, 0); push16(end, 0); push16(end, directory.length); push16(end, directory.length); push32(end, offset - directoryOffset); push32(end, directoryOffset); push16(end, 0);
  parts.push(new Uint8Array(end));
  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function exportExcel() {
  const rows = records();
  if (!rows.length) { status.textContent = 'Belum ada data di rekap untuk diunduh'; return; }
  const columns = [
    ['No.', '_number'], ['Tanggal Surat', 'tanggalSurat'], ['Hari', '_hari'], ['Tempat Surat', 'tempatSurat'], ['NIK', 'nik'], ['Nomor KK', 'nomorKk'], ['Nama Sesuai KTP', 'nama'], ['Tanggal Lahir', 'tanggalLahir'], ['Jenis Kelamin', 'jenisKelamin'], ['Alamat KTP', 'alamatKtp'], ['Alamat Usaha', 'alamatUsaha'], ['NIB', 'nib'], ['Nama Usaha', 'namaUsaha'], ['Bidang Usaha', 'bidangUsaha'], ['Email', 'email'], ['Nomor Telepon HP', 'telepon'], ['Disimpan Pada', 'diperbaruiPada']
  ];
  const cell = (value, ref, style = '') => `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const sheetRows = [columns.map(([label], i) => cell(label, `${columnName(i)}1`, ' s="1"')).join('')];
  rows.forEach((row, rowIndex) => {
    const values = columns.map(([, key], columnIndex) => {
      if (key === '_number') return rowIndex + 1;
      if (key === '_hari') return dayFromDate(row.tanggalSurat);
      if (key === 'tanggalSurat' || key === 'tanggalLahir') return formatDate(row[key]);
      if (key === 'diperbaruiPada') return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row[key]));
      return row[key] || '';
    });
    sheetRows.push(values.map((value, i) => cell(value, `${columnName(i)}${rowIndex + 2}`)).join(''));
  });
  const lastColumn = columnName(columns.length - 1);
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Rekap SPTJM" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123C32"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="1" borderId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${rows.length + 1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns.map(([,], i) => `<col min="${i + 1}" max="${i + 1}" width="${i < 4 ? 16 : 22}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows.map((cells, index) => `<row r="${index + 1}">${cells}</row>`).join('')}</sheetData><autoFilter ref="A1:${lastColumn}${rows.length + 1}"/></worksheet>`
  };
  const url = URL.createObjectURL(zip(files));
  const link = document.createElement('a');
  link.href = url; link.download = `rekap-sptjm-${new Date().toISOString().slice(0, 10)}.xlsx`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = `Rekap ${rows.length} orang berhasil diunduh sebagai Excel`;
}

let timer;
form.addEventListener('input', () => {
  updatePreview();
  clearTimeout(timer);
  timer = setTimeout(save, 350);
});

printButton.addEventListener('click', () => {
  if (!form.reportValidity()) return;
  save();
  saveRecap();
  window.print();
});

recapButton.addEventListener('click', () => { save(); saveRecap(); });
exportButton.addEventListener('click', exportExcel);

resetButton.addEventListener('click', () => {
  if (!confirm('Kosongkan semua data pada formulir ini?')) return;
  form.reset();
  localStorage.removeItem(storageKey);
  status.textContent = 'Formulir dikosongkan';
  updatePreview();
});

restore();
updatePreview();
