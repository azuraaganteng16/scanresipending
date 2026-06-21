// ===========================================
// Scan Resi Pending - Logika Aplikasi
// ===========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Konfigurasi asli dari proyek Firebase Anda
const firebaseConfig = {
    apiKey: "AIzaSyDIYwfI_mnZDcsLJQQMLKQoX-XkMY-dP08",
    authDomain: "scan-resi-app.firebaseapp.com",
    projectId: "scan-resi-app",
    storageBucket: "scan-resi-app.firebasestorage.app",
    messagingSenderId: "435869269413",
    appId: "1:435869269413:web:fb0934a7dabed3c5237c4c",
    measurementId: "G-VK4XFP40KE"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements - Kamera Resi
const readerDiv = document.getElementById('reader');
const placeholder = document.getElementById('placeholder');
const viewfinder = document.getElementById('viewfinder');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnExport = document.getElementById('btn-export');
const statusKamera = document.getElementById('status-kamera');
const totalSesiElement = document.getElementById('total-sesi');
const listCountElement = document.getElementById('list-count');
const listResiContainer = document.getElementById('list-resi');

// DOM Elements - Foto Label & Modal OCR
const inputFotoLabel = document.getElementById('input-foto-label');
const modalOcr = document.getElementById('modal-ocr');
const modalResiLabel = document.getElementById('modal-resi-label');
const btnModalClose = document.getElementById('btn-modal-close');
const ocrLoading = document.getElementById('ocr-loading');
const ocrProgress = document.getElementById('ocr-progress');
const ocrForm = document.getElementById('ocr-form');
const inputNamaBarang = document.getElementById('input-nama-barang');
const inputQty = document.getElementById('input-qty');
const ocrRawText = document.getElementById('ocr-raw-text');
const btnFotoUlang = document.getElementById('btn-foto-ulang');
const btnSimpanBarang = document.getElementById('btn-simpan-barang');

// State Variabel
let dataSesiLokal = []; // [{ id, noResi, waktuScan, namaBarang, qty }]
let html5QrcodeScanner = null;
let resiIdAktif = null; // id baris yang sedang diisi lewat modal OCR

// ===========================================
// SCAN BARCODE RESI
// ===========================================

function startScanning() {
    placeholder.classList.add('hidden');
    readerDiv.classList.remove('hidden');
    viewfinder.classList.remove('hidden');
    btnStart.disabled = true;
    btnStop.disabled = false;

    statusKamera.innerHTML = `<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Aktif`;
    statusKamera.className = "text-sm font-semibold text-emerald-400 mt-2 flex items-center justify-center gap-1.5";

    html5QrcodeScanner = new Html5Qrcode("reader");

    html5QrcodeScanner.start(
        { facingMode: "environment" },
        {
            fps: 15,
            qrbox: (width, height) => {
                return { width: width * 0.8, height: height * 0.6 };
            }
        },
        (decodedText) => {
            stopScanning();
            handleBarcodeScanned(decodedText);
        },
        (errorMessage) => {
            // Abaikan eror pencarian saat kamera sedang membidik frame
        }
    ).catch((err) => {
        console.error("Gagal akses kamera:", err);
        alert("Gagal membuka kamera. Pastikan izin kamera di browser sudah diberikan.");
        stopScanning();
    });
}

function stopScanning() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner = null;
            resetUI();
        }).catch((err) => {
            html5QrcodeScanner = null;
            resetUI();
        });
    } else {
        resetUI();
    }
}

function resetUI() {
    readerDiv.classList.add('hidden');
    viewfinder.classList.add('hidden');
    placeholder.classList.remove('hidden');
    btnStart.disabled = false;
    btnStop.disabled = true;
    statusKamera.innerHTML = `<span class="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span> Mati`;
    statusKamera.className = "text-sm font-semibold text-red-400 mt-2 flex items-center justify-center gap-1.5";
}

async function handleBarcodeScanned(nomorResi) {
    const resiBersih = nomorResi.trim();
    if (!resiBersih) return;

    if (navigator.vibrate) navigator.vibrate(150);

    // 1. Simpan ke Cloud Firestore
    try {
        await addDoc(collection(db, "pending_resi"), {
            no_resi: resiBersih,
            timestamp: serverTimestamp(),
            device: navigator.userAgent
        });
    } catch (error) {
        console.error("Firebase Error:", error);
        alert("Gagal simpan ke Firebase: " + error.message);
    }

    // 2. Simpan ke Sesi Lokal & Render Baris
    const entryId = 'r' + Date.now() + Math.floor(Math.random() * 1000);
    const waktuSekarang = new Date().toLocaleString('id-ID');

    dataSesiLokal.unshift({
        id: entryId,
        noResi: resiBersih,
        waktuScan: waktuSekarang,
        namaBarang: '',
        qty: ''
    });

    const checkEmpty = document.getElementById('empty-state');
    if (checkEmpty) checkEmpty.remove();

    listResiContainer.insertAdjacentHTML('afterbegin', renderResiRow(dataSesiLokal[0]));
    updateCounters();

    alert(`✅ RESI BERHASIL DI-SCAN!\n\nNomor: ${resiBersih}\n\nKamera otomatis berhenti agar tidak ganda. Klik 'Mulai Scan' lagi untuk paket selanjutnya, atau tambahkan foto label barang di daftar bawah.`);
}

// ===========================================
// RENDER BARIS RESI (dengan slot foto label)
// ===========================================

function renderResiRow(entry) {
    const itemSection = entry.namaBarang
        ? `
            <div class="item-summary" data-entry-id="${entry.id}">
                <i class="fa-solid fa-box-open"></i>
                <span>${escapeHtml(entry.namaBarang)} &mdash; Qty: ${escapeHtml(String(entry.qty || '-'))}</span>
                <button type="button" class="btn-edit-label" data-entry-id="${entry.id}">Edit</button>
            </div>`
        : `
            <button type="button" class="btn-add-label" data-entry-id="${entry.id}">
                <i class="fa-solid fa-camera"></i> Foto label barang
            </button>`;

    return `
        <div class="resi-row p-2.5 animate-fadeIn" id="row-${entry.id}">
            <div class="flex justify-between items-center">
                <span class="font-mono font-medium text-emerald-300 break-all">${escapeHtml(entry.noResi)}</span>
                <span class="text-xs text-gray-400 shrink-0 ml-2">${entry.waktuScan.split(', ')[1] || ''}</span>
            </div>
            ${itemSection}
        </div>
    `;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function refreshRow(entryId) {
    const entry = dataSesiLokal.find(e => e.id === entryId);
    const rowEl = document.getElementById('row-' + entryId);
    if (entry && rowEl) {
        rowEl.outerHTML = renderResiRow(entry);
    }
}

function updateCounters() {
    totalSesiElement.textContent = dataSesiLokal.length;
    listCountElement.textContent = dataSesiLokal.length;
}

// Delegasi klik untuk tombol "Foto label barang" / "Edit" di tiap baris
listResiContainer.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.btn-add-label');
    const editBtn = e.target.closest('.btn-edit-label');
    const target = addBtn || editBtn;
    if (!target) return;

    resiIdAktif = target.dataset.entryId;
    inputFotoLabel.value = ''; // reset supaya bisa pilih file yang sama lagi
    inputFotoLabel.click();
});

// ===========================================
// FOTO LABEL BARANG -> OCR -> MODAL KOREKSI
// ===========================================

inputFotoLabel.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !resiIdAktif) return;

    const entry = dataSesiLokal.find(en => en.id === resiIdAktif);
    if (!entry) return;

    openModal(entry.noResi);
    await runOcr(file);
});

function openModal(noResi) {
    modalResiLabel.textContent = noResi;
    ocrForm.classList.add('hidden');
    ocrLoading.classList.remove('hidden');
    ocrProgress.textContent = 'Mempersiapkan';
    modalOcr.classList.remove('hidden');
}

function closeModal() {
    modalOcr.classList.add('hidden');
    resiIdAktif = null;
}

btnModalClose.addEventListener('click', closeModal);
modalOcr.addEventListener('click', (e) => {
    if (e.target === modalOcr) closeModal();
});

btnFotoUlang.addEventListener('click', () => {
    inputFotoLabel.value = '';
    inputFotoLabel.click();
});

async function runOcr(file) {
    try {
        const result = await Tesseract.recognize(file, 'ind+eng', {
            logger: (m) => {
                if (m.status && typeof m.progress === 'number') {
                    const persen = Math.round(m.progress * 100);
                    const label = {
                        'loading tesseract core': 'Memuat mesin OCR',
                        'initializing tesseract': 'Menyiapkan OCR',
                        'loading language traineddata': 'Memuat data bahasa',
                        'initializing api': 'Menyiapkan API',
                        'recognizing text': 'Membaca teks label'
                    }[m.status] || m.status;
                    ocrProgress.textContent = `${label}... ${persen}%`;
                }
            }
        });

        const rawText = result.data.text || '';
        const parsed = parseLabelText(rawText);

        ocrRawText.textContent = rawText.trim() || '(tidak ada teks terbaca)';
        inputNamaBarang.value = parsed.namaBarang;
        inputQty.value = parsed.qty || 1;

        ocrLoading.classList.add('hidden');
        ocrForm.classList.remove('hidden');
    } catch (error) {
        console.error('OCR Error:', error);
        ocrLoading.classList.add('hidden');
        ocrForm.classList.remove('hidden');
        ocrRawText.textContent = '(OCR gagal: ' + error.message + ')';
        inputNamaBarang.value = '';
        inputQty.value = 1;
        inputNamaBarang.placeholder = 'OCR gagal membaca, isi manual';
    }
}

// ===========================================
// PARSING TEKS LABEL -> Nama Barang + Qty
// Disesuaikan dengan format label J&T/Tokopedia/Shopee:
//   "Product Name ... SKU ... Seller SKU ... Qty"
//   "Jumlah : 1pcs, Barang : <kode>"  (fallback)
// ===========================================

function parseLabelText(rawText) {
    const text = rawText.replace(/\r/g, '');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let namaBarang = '';
    let qty = '';

    // --- Coba pola 1: blok "Product Name ... Qty" ---
    const productNameIdx = lines.findIndex(l => /product\s*name/i.test(l));
    if (productNameIdx !== -1) {
        // Berhenti mengumpulkan baris begitu ketemu penanda akhir tabel/label lain
        const stopPatterns = /^(order\s*id|estimated\s*date|in\s*transit|n\s*transit|wajib|tidak\s*terima|rekam\s*jelas|dukung\s*kami|jangan\s*dibanting)\b/i;
        const collected = [];

        for (let i = productNameIdx + 1; i < lines.length && collected.length < 5; i++) {
            let line = lines[i];
            if (stopPatterns.test(line)) break;

            // Baris pertama tabel biasanya diakhiri qty satu/dua digit ("...  1")
            // Lepas angka di ujung baris itu sebagai qty, sisanya (nama + SKU) tetap disimpan
            // apa adanya supaya tidak salah potong - user bisa rapikan manual di form.
            if (i === productNameIdx + 1) {
                const trailingQty = line.match(/^(.*\S)\s+(\d{1,2})$/);
                if (trailingQty) {
                    qty = trailingQty[2];
                    line = trailingQty[1];
                }
            }

            collected.push(line);
        }

        if (collected.length) {
            namaBarang = collected.join(' ').replace(/\s{2,}/g, ' ').trim();
        }
    }

    // --- Fallback / pelengkap: pola "Jumlah : 1pcs, Barang : XXX" ---
    const jumlahMatch = text.match(/Jumlah\s*:?\s*(\d+)\s*p?cs?\.?,?\s*Barang\s*:?\s*([^\n]+)/i);
    if (jumlahMatch) {
        const qtyDariJumlah = jumlahMatch[1];
        const barangDariJumlah = jumlahMatch[2].trim();
        if (!qty) qty = qtyDariJumlah;
        if (!namaBarang) namaBarang = barangDariJumlah;
    }

    // --- Fallback terakhir: cari pola umum "Qty: N" atau "Qty Total: N" berdiri sendiri ---
    if (!qty) {
        const qtyLoose = text.match(/Qty(?:\s*Total)?\s*:?\s*(\d{1,3})/i);
        if (qtyLoose) qty = qtyLoose[1];
    }

    return {
        namaBarang: namaBarang || '',
        qty: qty || ''
    };
}

// ===========================================
// SIMPAN HASIL KOREKSI KE BARIS RESI
// ===========================================

btnSimpanBarang.addEventListener('click', () => {
    if (!resiIdAktif) return;
    const entry = dataSesiLokal.find(en => en.id === resiIdAktif);
    if (!entry) return;

    entry.namaBarang = inputNamaBarang.value.trim();
    entry.qty = inputQty.value.trim();

    refreshRow(resiIdAktif);
    closeModal();
});

// ===========================================
// EXPORT EXCEL & RESET SESI
// ===========================================

function exportToExcelAndReset() {
    if (dataSesiLokal.length === 0) {
        alert("Belum ada data resi pada sesi ini untuk di-export!");
        return;
    }

    const dataExport = dataSesiLokal.map(entry => ({
        'No Resi': entry.noResi,
        'Nama Barang': entry.namaBarang || '',
        'Qty': entry.qty || '',
        'Waktu Scan': entry.waktuScan
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    worksheet['!cols'] = [
        { wch: 22 }, // No Resi
        { wch: 45 }, // Nama Barang
        { wch: 8 },  // Qty
        { wch: 22 }  // Waktu Scan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resi Pending");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Rekap_Resi_Pending_${tanggal}.xlsx`);

    dataSesiLokal = [];
    totalSesiElement.textContent = "0";
    listCountElement.textContent = "0";
    listResiContainer.innerHTML = `<p id="empty-state" class="text-center text-gray-500 py-6 italic">Belum ada resi yang di-scan pada sesi ini.</p>`;

    alert("📊 File Excel berhasil di-download!\n\nKolom Nama Barang & Qty ikut ter-export sesuai data yang sudah dikoreksi. Hitungan layar di-reset, data tetap aman di Firebase Cloud.");
}

// Event Listener Tombol
btnStart.addEventListener('click', startScanning);
btnStop.addEventListener('click', stopScanning);
btnExport.addEventListener('click', exportToExcelAndReset);
