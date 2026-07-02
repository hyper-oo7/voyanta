<#
.SYNOPSIS
Starts the Voyanta development environment (Frontend, Python Backend, PDF Service).

.DESCRIPTION
This script checks for prerequisites (Python, Node.js, dependencies), checks if ports are occupied, starts the necessary backend services in the background, starts the frontend, waits for health checks, and opens the browser.
#>

$ErrorActionPreference = "Stop"

function Write-ColorMessage ($Message, $Color) {
    Write-Host ">>> $Message" -ForegroundColor $Color
}

function Test-Port ($Port) {
    $tcpConnection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $tcpConnection
}

function Check-Command ($Command) {
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# --- 1. Verify Prerequisites ---
Write-ColorMessage "Verifying prerequisites..." "Cyan"

# Node.js and NPM
if (-not (Check-Command "node")) {
    Write-ColorMessage "Node.js is not installed or not in PATH. Please install Node.js." "Red"
    exit 1
}
if (-not (Check-Command "npm")) {
    Write-ColorMessage "npm is not installed or not in PATH. Please install npm." "Red"
    exit 1
}

# Python
$pythonCmd = ""
$candidates = @("python", "python3", "py")

foreach ($cmd in $candidates) {
    if (Check-Command $cmd) {
        $testOutput = try { & $cmd --version 2>&1 } catch { $_ }
        if ($testOutput -notmatch "Python was not found" -and $testOutput -match "Python") {
            $pythonCmd = $cmd
            break
        }
    }
}

if ([string]::IsNullOrEmpty($pythonCmd)) {
    Write-ColorMessage "Python is not installed or not added to PATH. Please install Python 3.9+ from python.org and ensure 'Add to PATH' is checked during installation." "Red"
    exit 1
} else {
    Write-ColorMessage "Using Python executable: $pythonCmd" "Green"
}

# Dependencies
if (-not (Test-Path ".\frontend\node_modules")) {
    Write-ColorMessage "Frontend dependencies are missing. Run 'npm install' in the 'frontend' directory." "Red"
    exit 1
}
if (-not (Test-Path ".\pdf-service\node_modules")) {
    Write-ColorMessage "PDF Service dependencies are missing. Run 'npm install' in the 'pdf-service' directory." "Red"
    exit 1
}

# --- 2. Check Ports ---
Write-ColorMessage "Checking ports..." "Cyan"
$ports = @(3000, 8001, 8002)
$occupied = $false
foreach ($port in $ports) {
    if (Test-Port $port) {
        Write-ColorMessage "Port $port is already in use. Please run .\stop-all.ps1 or free the port." "Red"
        $occupied = $true
    }
}
if ($occupied) { exit 1 }

# --- 3. Start Python Backend (FastAPI on 8001) ---
Write-ColorMessage "Starting Python Backend (Port 8001)..." "Yellow"
$backendJob = Start-Process -FilePath "uvicorn" -ArgumentList "src.main:app", "--port", "8001" -WorkingDirectory ".\backend" -PassThru -NoNewWindow

# --- 4. Start PDF Service (Node on 8002) ---
Write-ColorMessage "Starting PDF Service (Port 8002)..." "Yellow"
$pdfJob = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory ".\pdf-service" -PassThru -NoNewWindow

# --- 5. Wait for Python Backend and PDF Service Health ---
Write-ColorMessage "Waiting for Backend (8001) and PDF Service (8002) to become healthy..." "Cyan"
$retries = 15
$backendHealthy = $false
$pdfHealthy = $false
while ($retries -gt 0) {
    try {
        if (-not $backendHealthy) {
            $res1 = Invoke-WebRequest -Uri "http://127.0.0.1:8001/api/health" -Method Get -UseBasicParsing -ErrorAction Stop
            if ($res1.StatusCode -eq 200) { $backendHealthy = $true }
        }
        if (-not $pdfHealthy) {
            $res2 = Invoke-WebRequest -Uri "http://127.0.0.1:8002/health" -Method Get -UseBasicParsing -ErrorAction Stop
            if ($res2.StatusCode -eq 200) { $pdfHealthy = $true }
        }
        if ($backendHealthy -and $pdfHealthy) { break }
    } catch {
        # ignore
    }
    Start-Sleep -Seconds 2
    $retries--
}

if (-not ($backendHealthy -and $pdfHealthy)) {
    Write-ColorMessage "Services failed to start or become healthy (Backend: $backendHealthy, PDF: $pdfHealthy). Stopping processes..." "Red"
    Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $pdfJob.Id -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-ColorMessage "Backend and PDF Service are healthy!" "Green"

# --- 6. Start Vite Frontend (Port 3000) ---
Write-ColorMessage "Starting Vite Frontend (Port 3000)..." "Yellow"
$frontendJob = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory ".\frontend" -PassThru -NoNewWindow

# Wait a moment for Vite to bind
Start-Sleep -Seconds 3

# --- 7. Open Browser ---
Write-ColorMessage "Opening browser at http://localhost:3000..." "Green"
Start-Process "http://localhost:3000"

Write-ColorMessage "All services started successfully." "Green"
Write-ColorMessage "Run .\stop-all.ps1 to shut down." "Cyan"

# Save process IDs to a file for stop-all.ps1
$pids = "$($backendJob.Id),$($pdfJob.Id),$($frontendJob.Id)"
Set-Content -Path ".\.dev-pids" -Value $pids
