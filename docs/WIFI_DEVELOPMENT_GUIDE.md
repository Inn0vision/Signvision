# SignVision — Wi-Fi & Local Network Development Guide

> **Practical guide for connecting physical mobile devices to local SignVision backend servers over Wi-Fi and USB.**

---

## ⚡ 1. Brief Quickstart (TL;DR)

Follow this 4-step checklist to connect your physical Android or iOS device to your development computer over Wi-Fi:

### 4-Step Quick Checklist
1. **Connect to Same Wi-Fi**: Ensure your computer and mobile device are on the exact same Wi-Fi network (avoid public "Guest" networks that isolate clients).
2. **Find Your PC's LAN IPv4**:
   ```bash
   # Linux
   hostname -I | awk '{print $1}'
   # macOS
   ipconfig getifaddr en0
   # Windows (PowerShell)
   (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*').IPAddress
   ```
   *(Example: `10.26.215.140` or `192.168.1.5`)*
3. **Configure Frontend Endpoints (`Application/.env`)**:
   ```ini
   EXPO_PUBLIC_API_URL=http://<YOUR_PC_IP>:8000
   EXPO_PUBLIC_VIDEO_API_URL=http://<YOUR_PC_IP>:8001
   ```
4. **Bind Backends to `0.0.0.0`**:
   Ensure both backends run with `--host 0.0.0.0` (not `127.0.0.1` or `localhost`).

### USB Reverse Port Forwarding Cheat Sheet
If Wi-Fi network client isolation blocks direct peer connections, connect your device via USB with USB Debugging enabled:
```bash
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8001 tcp:8001
adb reverse tcp:8081 tcp:8081
```
*Now `http://localhost:8000` and `http://localhost:8001` will route directly to your host machine.*

---

## 🛠️ 2. Detailed Wireless Networking Guide

### 2.1 Understanding Mobile vs. Localhost Routing

When running code in an Android or iOS runtime, `localhost` and `127.0.0.1` refer to the **mobile device itself**, not your development workstation. 

```
┌────────────────────────────────────────────────────────┐
│                   Local Wi-Fi Network                  │
│                                                        │
│   💻 Dev Computer (10.26.215.140)                     │
│      ├── Core Backend (Listening on 0.0.0.0:8000)      │
│      ├── Video Service (Listening on 0.0.0.0:8001)     │
│      └── Metro Bundler (Listening on 0.0.0.0:8081)     │
│             ▲                    ▲                     │
│             │ HTTP REST          │ HTTP Multipart      │
│             │ :8000              │ :8001               │
│   📱 Physical Android Phone (10.26.215.195)            │
│      └── SignVision Dev Client App                     │
└────────────────────────────────────────────────────────┘
```

If the backend server binds only to `127.0.0.1`, the operating system will drop all inbound packets originating from external devices on the LAN. Binding to `0.0.0.0` instructs the kernel to listen on all network interfaces.

---

### 2.2 Host Firewall & Port Clearance

Some operating systems (especially Linux with `ufw` or Windows Defender Firewall) automatically reject inbound connections on unfamiliar ports.

#### Linux (`ufw`)
```bash
# Allow inbound traffic on development ports
sudo ufw allow 8000/tcp comment "SignVision Core Backend"
sudo ufw allow 8001/tcp comment "SignVision Video Microservice"
sudo ufw allow 8081/tcp comment "Expo Metro Bundler"
sudo ufw reload
```

#### Windows Defender
Ensure private network discovery is enabled and allow `uvicorn` and `node` through the firewall when prompted, or run:
```powershell
New-NetFirewallRule -DisplayName "SignVision Dev Ports" -Direction Inbound -LocalPort 8000,8001,8081 -Protocol TCP -Action Allow
```

---

### 2.3 Validating Mobile Connectivity

Before opening the SignVision application, verify that your phone can reach your computer:

1. Open Chrome or Safari on your **mobile phone**.
2. Navigate to: `http://<YOUR_PC_IP>:8000/health`
3. If configured properly, the mobile browser will display:
   ```json
   { "status": "ok", "version": "1.0.0" }
   ```
4. Navigate to: `http://<YOUR_PC_IP>:8001/health`
5. The mobile browser will display:
   ```json
   { "status": "healthy", "service": "SignVision Video Translation API" }
   ```
6. If the page times out, verify:
   - Both devices are on the exact same SSID.
   - You did not enter `localhost` in the mobile browser.
   - The computer's firewall allows port 8000 and 8001.

---

### 2.4 Metro Bundler Cache Invalidation

When updating `Application/.env` with a new IP address, Metro caches environment variables in memory. Always restart Metro with the `--clear` flag:

```bash
cd Application
npx expo start --dev-client --clear
```

---

*SignVision — Seamless local and wireless development.*
