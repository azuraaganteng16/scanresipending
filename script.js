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

// DOM Elements
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

// State Variabel
let dataSesiLokal = [];
let html5QrcodeScanner = null;

// Fungsi Memulai Kamera Belakang secara Instan
function startScanning() {
    placeholder.classList.add('hidden');
    readerDiv.classList.remove('hidden');
    viewfinder.classList.remove('hidden');
    btnStart.disabled = true;
    btnStop.disabled = false;

    statusKamera.innerHTML = `<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Aktif`;
    statusKamera.className = "text-sm font-semibold text-emerald-400 mt-2 flex items-center justify-center gap-1.5";

    // Membuat instance pembaca barcode baru
    html5QrcodeScanner = new Html5Qrcode("reader");

    // Menjalankan langsung kamera belakang (environment)
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        {
            fps: 15, // Kecepatan scan per detik
            qrbox: (width, height) => {
                return { width: width * 0.8, height: height * 0.6 }; // Kotak fokus bidik barcode
            }
        },
        (decodedText) => {
            // JIKA BERHASIL TER-SCAN:
            stopScanning(); // Langsung matikan kamera agar tidak scan 2x
            handleBarcodeScanned(decodedText); // Kirim data ke Firebase
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

// Fungsi Mematikan Kamera
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

// Logika Pengiriman Data ke Firebase
async function handleBarcodeScanned(nomorResi) {
    const resiBersih = nomorResi.trim();
    if (!resiBersih) return;

    if (navigator.vibrate) navigator.vibrate(150); // Getar HP

    // 1. Simpan Cloud Firestore
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

    // 2. Simpan Sesi Lokal & Update UI Tampilan
    const waktuSekarang = new Date().toLocaleString('id-ID');
    dataSesiLokal.unshift({ 'No Resi': resiBersih, 'Waktu Scan': waktuSekarang });

    const checkEmpty = document.getElementById('empty-state');
    if (checkEmpty) checkEmpty.remove();

    const rowHTML = `
        <div class="resi-row flex justify-between items-center p-2.5 animate-fadeIn">
            <span class="font-mono font-medium text-emerald-300 break-all">${resiBersih}</span>
            <span class="text-xs text-gray-400 shrink-0 ml-2">${new Date().toLocaleTimeString('id-ID')}</span>
        </div>
    `;
    listResiContainer.insertAdjacentHTML('afterbegin', rowHTML);
    totalSesiElement.textContent = dataSesiLokal.length;
    listCountElement.textContent = dataSesiLokal.length;

    // 3. Notifikasi Pop-up Sukses
    alert(`✅ RESI BERHASIL DI-SCAN!\n\nNomor: ${resiBersih}\n\nKamera otomatis berhenti agar tidak ganda. Klik 'Mulai Scan' lagi untuk paket selanjutnya.`);
}

// Logika Excel & Reset Hitungan Sesi ke 0
function exportToExcelAndReset() {
    if (dataSesiLokal.length === 0) {
        alert("Belum ada data resi pada sesi ini untuk di-export!");
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataSesiLokal);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resi Pending");

    const tanggal = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Rekap_Resi_Pending_${tanggal}.xlsx`);

    // RESET TOTAL COUNTER SCREEN
    dataSesiLokal = [];
    totalSesiElement.textContent = "0";
    listCountElement.textContent = "0";
    listResiContainer.innerHTML = `<p id="empty-state" class="text-center text-gray-500 py-6 italic">Belum ada resi yang di-scan pada sesi ini.</p>`;

    alert("📊 File Excel berhasil di-download!\n\nHitungan total resi di layar telah ter-reset kembali ke nol. Data Anda tetap tersimpan utuh di Firebase Cloud.");
}

// Event Listener Tombol
btnStart.addEventListener('click', startScanning);
btnStop.addEventListener('click', stopScanning);
btnExport.addEventListener('click', exportToExcelAndReset);
