document.addEventListener("DOMContentLoaded", () => {
  // --- KONFIGURASI MQTT ---
  const MQTT_CONTROL_TOPIC = "pid/control";         // Sesuai ESP32
  const MQTT_FEEDBACK_TOPIC = "pid/status";     // Sesuai ESP32, berisi data hasil proses
  const CLIENT_ID = "WebAppClient_" + Math.random().toString(16).substr(2, 8);

  // --- Elemen UI ---
  const mqttStatus = document.getElementById("mqtt-status");
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  const btnUpdate = document.getElementById("btn-update");
  const btnCsv = document.getElementById("btn-csv");

  const tempValue = document.getElementById("temp-value");
  const spValue = document.getElementById("sp-value");
  const pwmValue = document.getElementById("pwm-value");
  const timeValue = document.getElementById("time-value");

  const logStatus = document.getElementById("log-status");
  const logMethod = document.getElementById("log-method");
  const logKp = document.getElementById("log-kp");
  const logKi = document.getElementById("log-ki");
  const logKd = document.getElementById("log-kd");

    // --- PENAMBAHAN: Elemen UI untuk Metrik Performa ---
  const riseTimeValue = document.getElementById("rise-time-value");
  const settlingTimeValue = document.getElementById("settling-time-value");
  const overshootValue = document.getElementById("overshoot-value");
  const ssErrorValue = document.getElementById("ss-error-value");
  let pwmHistory = [];
  
  // --- Inisialisasi Chart.js ---
  const ctx = document.getElementById("temp-chart").getContext("2d");
  const tempChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Suhu Aktual (°C)",
          data: [],
          borderColor: "rgba(220, 53, 69, 1)",
          backgroundColor: "rgba(220, 53, 69, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
        },
        {
          label: "Setpoint (°C)",
          data: [],
          borderColor: "rgba(0, 123, 255, 1)",
          backgroundColor: "rgba(0, 123, 255, 0.1)",
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: "Suhu (°C)" },
          min: 0,
          max: 70,
          ticks: {
            callback: function (value) {
              return value + " °C";
            },
          },
        },
        x: {
          title: { display: true, text: "Waktu (detik)" },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  // --- Logika MQTT ---
  const MQTT_BROKER_URL = "wss://ff18061fe6194a558a6a6a6ee63aa781.s1.eu.hivemq.cloud:8884/mqtt";
  const MQTT_CLIENT_ID = CLIENT_ID;

  const connectOptions = {
    clientId: MQTT_CLIENT_ID,
    clean: true,
    username: "Himmi",
    password: "Polines2025"
  };

  // Membuat koneksi
  const client = mqtt.connect(MQTT_BROKER_URL, connectOptions);

  client.on("connect", function () {
    console.log("Terhubung ke MQTT Broker!");
    console.log(CLIENT_ID);
    mqttStatus.innerHTML = '<span class="dot connected"></span> CONNECTED';

    // Subscribe ke topik FEEDBACK (data dari ESP32)
    client.subscribe(MQTT_FEEDBACK_TOPIC, function (err) {
      if (!err) {
        console.log(`Berlangganan topik: ${MQTT_FEEDBACK_TOPIC}`);
      } else {
        console.error("Gagal subscribe:", err);
      }
    });
  });

  // Handler pesan masuk dari ESP32 (topik feedback)
  client.on("message", function (topic, payload) {
    if (topic === MQTT_FEEDBACK_TOPIC) {
      const message = payload.toString();
      console.log(`Pesan diterima dari topik [${topic}]: ${message}`);
      try {
        const data = JSON.parse(message);
        updateDashboard(data);
      } catch (e) {
        console.error("Gagal mem-parsing pesan JSON:", e);
      }
    }
  });

  client.on("close", function () {
    console.log("Koneksi MQTT terputus.");
    mqttStatus.innerHTML =
      '<span class="dot disconnected"></span> DISCONNECTED';
  });

  client.on("error", function (error) {
    console.error("Kesalahan koneksi MQTT:", error);
    mqttStatus.innerHTML =
      '<span class="dot disconnected"></span> CONNECTION FAILED';
    client.end();
  });

  // --- Fungsi Update Tampilan Dashboard ---
  function updateDashboard(data) {
    // Update kartu
    tempValue.textContent = `${data.temperature?.toFixed(2) ?? "-"} °C`;
    spValue.textContent = `${data.setpoint?.toFixed(2) ?? "-"} °C`;
    pwmValue.textContent = data.pwm_output !== undefined ? data.pwm_output.toFixed(0) : "-";
    timeValue.textContent = `${data.elapsed_time ?? "-"} s`;

      // --- PENAMBAHAN: Update kartu metrik performa ---
    riseTimeValue.textContent = `${data.rise_time?.toFixed(2) ?? "-"} s`;
    // Handle kasus khusus untuk settling time jika tidak tercapai (-1)
    if (data.settling_time === -1) {
        settlingTimeValue.textContent = "N/A";
    } else {
        settlingTimeValue.textContent = `${data.settling_time?.toFixed(2) ?? "-"} s`;
    }
    overshootValue.textContent = `${data.overshoot?.toFixed(2) ?? "-"} %`;
    ssErrorValue.textContent = `${data.ss_error?.toFixed(2) ?? "-"} °C`;


    // Update log
    logStatus.textContent = data.state ?? "-";
    logMethod.textContent = data.pid_params?.method ?? "-";
    if (data.pid_params) {
      logKp.textContent = data.pid_params.Kp.toFixed(2);
      logKi.textContent = data.pid_params.Ki.toFixed(2);
      logKd.textContent = data.pid_params.Kd.toFixed(2);
    } else {
      logKp.textContent = logKi.textContent = logKd.textContent = "-";
    }

    // Update status tombol jika proses berhenti dari ESP32
    if (data.state !== "RUNNING" && btnStart.disabled) {
      setRunningState(false);
    }

    // Update grafik (hanya jika RUNNING)
    if (data.state === "RUNNING") {
      const chartLabels = tempChart.data.labels;
      const tempDataset = tempChart.data.datasets[0].data;
      const spDataset = tempChart.data.datasets[1].data;

      chartLabels.push(data.elapsed_time);
      tempDataset.push(data.temperature);
      spDataset.push(data.setpoint);
      pwmHistory.push(data.pwm_output);

      tempChart.update();
    }
  }

  function clearChart() {
    tempChart.data.labels = [];
    tempChart.data.datasets[0].data = [];
    tempChart.data.datasets[1].data = [];
    pwmHistory = [];
    timeHistoryMs = [];
    tempChart.update();
  }

 // [LOGIKA BARU] Tandai bahwa ada perubahan pengaturan
  const settingInputs = ["setpoint", "duration", "conv_kp", "conv_ki", "conv_kd", "kp_min", "kp_max", "ki_min", "ki_max", "kd_min", "kd_max"];
  settingInputs.forEach(id => {
    const inputElement = document.getElementById(id);
    if (inputElement) {
      inputElement.addEventListener("change", () => {
        settingsChanged = true;
        console.log("Pengaturan diubah, bendera diaktifkan.");
      });
    }
  });

  // --- Event Listeners ---
  btnStart.addEventListener("click", () => {
        // [LOGIKA BARU] Periksa bendera sebelum memulai
    if (settingsChanged) {
      alert("Anda telah mengubah parameter. Harap tekan tombol 'Update Settings' terlebih dahulu untuk menerapkan perubahan sebelum memulai.");
      return; // Batalkan proses start
    }
    // Kirim perintah start ke ESP32
    const payload = {
      command: "start",
      method: document.getElementById("method").value,      // "conventional", "pso", "ga"
      setpoint: parseFloat(document.getElementById("setpoint").value), // suhu
      duration: parseInt(document.getElementById("duration").value),   // detik
      fitness: document.getElementById("fitness").value     // "iae", "ise", "itae", "itse"
    };
    sendMessage(MQTT_CONTROL_TOPIC, JSON.stringify(payload));
    setRunningState(true);
    clearChart();
  });

  btnStop.addEventListener("click", () => {
    const payload = { command: "stop" };
    sendMessage(MQTT_CONTROL_TOPIC, JSON.stringify(payload));
    setRunningState(false);
  });

  btnUpdate.addEventListener("click", () => {
    const payload = {
      command: "update_settings",
      setpoint: parseFloat(document.getElementById("setpoint").value),
       duration: parseInt(document.getElementById("duration").value),
    method: document.getElementById("method").value,      // "conventional", "pso", "ga"
    fitness: document.getElementById("fitness").value,    // "iae", "ise", "itae", "itse"
    // PID Konvensional
    conv_kp: parseFloat(document.getElementById("conv_kp").value),
    conv_ki: parseFloat(document.getElementById("conv_ki").value),
    conv_kd: parseFloat(document.getElementById("conv_kd").value),
    // Batas parameter PSO/GA
    kp_min: parseFloat(document.getElementById("kp_min").value),
    kp_max: parseFloat(document.getElementById("kp_max").value),
    ki_min: parseFloat(document.getElementById("ki_min").value),
    ki_max: parseFloat(document.getElementById("ki_max").value),
    kd_min: parseFloat(document.getElementById("kd_min").value),
    kd_max: parseFloat(document.getElementById("kd_max").value)
    };
    sendMessage(MQTT_CONTROL_TOPIC, JSON.stringify(payload));

       // [LOGIKA BARU] Reset bendera setelah update dikirim
    settingsChanged = false;
    console.log("Pengaturan diupdate, bendera dinonaktifkan.");
    alert("Perintah 'Update Settings' telah dikirim!");
  });

  btnCsv.addEventListener("click", () => {
    // Ambil data dari chart (misal suhu aktual dan setpoint)
    const chartLabels = tempChart.data.labels;
    const tempDataset = tempChart.data.datasets[0].data;
    const spDataset = tempChart.data.datasets[1].data;

    // Header CSV
    let csv = "Waktu (detik);Suhu Aktual (°C);Setpoint (°C); PWM\n";

    // Gabungkan data menjadi baris CSV
    for (let i = 0; i < chartLabels.length; i++) {
      const waktu = chartLabels[i];
      const suhu = tempDataset[i] !== undefined ? tempDataset[i].toFixed(2) : "";
      const setpoint = spDataset[i] !== undefined ? spDataset[i].toFixed(2) : "";
      const pwm = pwmHistory[i] !== undefined ? pwmHistory[i].toFixed(0) : "";
      csv += `${waktu};${suhu};${setpoint};${pwm}\n`;
    }

    // Buat blob dan link download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    // Buat elemen link sementara untuk download
    const a = document.createElement("a");
    a.href = url;
    a.download = "log_suhu.csv";
    document.body.appendChild(a);
    a.click();

    // Bersihkan
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  });

  function sendMessage(topic, message) {
    if (client.connected) {
      client.publish(topic, message, (error) => {
        if (error) {
          console.error("Gagal mengirim pesan:", error);
          alert("Gagal mengirim perintah ke MQTT Broker.");
        } else {
          console.log(`Pesan terkirim ke topik ${topic}:`, message);
        }
      });
    } else {
      console.warn("Tidak terhubung ke MQTT Broker. Tidak dapat mengirim perintah.");
      alert("Tidak terhubung ke MQTT Broker. Tidak dapat mengirim perintah.");
    }
  }

  function setRunningState(isRunning) {
    btnStart.disabled = isRunning;
    btnStop.disabled = !isRunning;
    btnUpdate.disabled = isRunning;
    document.getElementById("method").disabled = isRunning;
    document.getElementById("duration").disabled = isRunning;
    document.getElementById("fitness").disabled = isRunning;
  }

});






