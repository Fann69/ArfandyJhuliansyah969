/**
 * Client-Side Script: Portal Kampus Lab
 * Menangani interaktivitas mode switch, simulator pengujian skenario, dan interaksi UI
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mode Switch Handler
  const modeToggles = document.querySelectorAll('[data-action="toggle-mode"]');
  modeToggles.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const targetMode = btn.getAttribute('data-target-mode');
      try {
        const res = await fetch('/api/lab/toggle-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: targetMode })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        }
      } catch (err) {
        console.error('Gagal mengganti mode:', err);
      }
    });
  });

  // 2. Simulator SQL Injection
  const sqliForm = document.getElementById('sqliSimulatorForm');
  if (sqliForm) {
    sqliForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('sqliQueryInput').value;
      const resultBox = document.getElementById('sqliResultConsole');
      resultBox.innerHTML = '<span style="color:#94a3b8">Menjalankan pengujian query ke backend...</span>';

      try {
        const res = await fetch(`/api/courses/search?q=${encodeURIComponent(input)}`);
        const data = await res.json();
        resultBox.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        resultBox.textContent = 'Error: ' + err.message;
      }
    });
  }

  // 3. Simulator IDOR
  const idorForm = document.getElementById('idorSimulatorForm');
  if (idorForm) {
    idorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentId = document.getElementById('idorStudentIdInput').value;
      const resultBox = document.getElementById('idorResultConsole');
      resultBox.innerHTML = '<span style="color:#94a3b8">Mengirim request GET ke /api/students/grades/' + studentId + '...</span>';

      try {
        const res = await fetch(`/api/students/grades/${studentId}`, {
          headers: { 'Accept': 'application/json' }
        });
        const status = res.status;
        const data = await res.json();
        resultBox.textContent = `HTTP STATUS: ${status}\n\n` + JSON.stringify(data, null, 2);
      } catch (err) {
        resultBox.textContent = 'Error: ' + err.message;
      }
    });
  }

  // 4. Simulator CSRF Attack
  const csrfAttackBtn = document.getElementById('btnTriggerCsrfAttack');
  if (csrfAttackBtn) {
    csrfAttackBtn.addEventListener('click', async () => {
      const consoleBox = document.getElementById('csrfResultConsole');
      const forgedEmail = document.getElementById('forgedEmailInput').value;
      consoleBox.innerHTML = '<span style="color:#94a3b8">Mengirim request cross-site palsu TANPA token CSRF...</span>';

      try {
        // Kirim POST tanpa _csrf token
        const res = await fetch('/api/profile/update-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ new_email: forgedEmail })
        });

        const status = res.status;
        const data = await res.json();
        consoleBox.textContent = `HTTP STATUS: ${status}\n\n` + JSON.stringify(data, null, 2);
      } catch (err) {
        consoleBox.textContent = 'Error: ' + err.message;
      }
    });
  }

  // 5. Simulator Brute Force Login
  const bruteForceBtn = document.getElementById('btnRunBruteForce');
  if (bruteForceBtn) {
    bruteForceBtn.addEventListener('click', async () => {
      const consoleBox = document.getElementById('bruteResultConsole');
      const username = document.getElementById('bruteUsername').value;
      const passwords = ['123456', 'password', 'qwerty', 'admin123', 'rahasia', 'dosen123'];
      consoleBox.textContent = `Memulai pengujian 6 percobaan login berturut-turut untuk user: "${username}"...\n\n`;

      for (let i = 0; i < passwords.length; i++) {
        const pwd = passwords[i];
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ username, password: pwd })
          });
          const data = await res.json();
          consoleBox.textContent += `[Percobaan #${i+1}] Password: "${pwd}" -> Status: HTTP ${res.status} | Pesan: "${data.error || 'Sukses'}"\n`;
        } catch (err) {
          consoleBox.textContent += `[Percobaan #${i+1}] Error: ${err.message}\n`;
        }
      }
    });
  }

  // 6. Simulator Privilege Escalation
  const privEscBtn = document.getElementById('btnTestPrivEscalation');
  if (privEscBtn) {
    privEscBtn.addEventListener('click', async () => {
      const consoleBox = document.getElementById('privResultConsole');
      consoleBox.innerHTML = '<span style="color:#94a3b8">Mengakses /api/admin/users dengan hak sesi saat ini...</span>';

      try {
        const res = await fetch('/api/admin/users', {
          headers: { 'Accept': 'application/json' }
        });
        const status = res.status;
        const data = await res.json();
        consoleBox.textContent = `HTTP STATUS: ${status}\n\n` + JSON.stringify(data, null, 2);
      } catch (err) {
        consoleBox.textContent = 'Error: ' + err.message;
      }
    });
  }

  // 7. Test All Scenarios Button di Lab Dashboard
  const runAllTestsBtn = document.getElementById('btnRunAllLabTests');
  if (runAllTestsBtn) {
    runAllTestsBtn.addEventListener('click', async () => {
      const consoleBox = document.getElementById('allTestsResultBox');
      const currentMode = runAllTestsBtn.getAttribute('data-mode') || 'vulnerable';
      consoleBox.innerHTML = '<span style="color:#94a3b8">Menjalankan suite pengujian 8 skenario di backend...</span>';

      try {
        const res = await fetch(`/api/lab/run-tests?mode=${currentMode}`);
        const data = await res.json();
        consoleBox.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        consoleBox.textContent = 'Error: ' + err.message;
      }
    });
  }
});
