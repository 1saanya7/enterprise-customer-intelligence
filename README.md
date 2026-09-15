# Northstar Intelligence

Northstar Intelligence is an enterprise customer and product intelligence application. It combines quarterly revenue, customer-support signals, and warranty policies into an evidence-led investigation.

## Run on Windows

Requirements: Python 3.10+ and Node.js 22.12+.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
.\.venv\Scripts\python.exe -m pip install --no-deps -e .
Set-Location frontend
npm.cmd ci
Set-Location ..
powershell.exe -ExecutionPolicy Bypass -File scripts\start-local.ps1
```

Open `http://127.0.0.1:5173`. The first startup creates private workspace credentials in `.local/local-accounts.json`; the file is ignored by Git. The app binds to loopback only.

Check both services or recover them with:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\status-local.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\restart-local.ps1
```

The launcher verifies the API, database readiness and login page before reporting success. If either process fails during startup, it stops the other process and points to the local error logs.

To stop both recorded project processes:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\stop-local.ps1
```


