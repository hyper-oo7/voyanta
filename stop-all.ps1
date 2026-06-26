<#
.SYNOPSIS
Stops the Voyanta development environment processes started by start-all.ps1.
#>

$ErrorActionPreference = "Continue"

function Write-ColorMessage ($Message, $Color) {
    Write-Host ">>> $Message" -ForegroundColor $Color
}

$pidFile = ".\.dev-pids"

if (-not (Test-Path $pidFile)) {
    Write-ColorMessage "No .dev-pids file found. Searching for leftover node/python processes..." "Yellow"
    # Alternatively, you can kill by port if pids are missing
    $nodePids = Get-NetTCPConnection -LocalPort 3000, 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    $pythonPids = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    
    foreach ($p in $nodePids) {
        Write-ColorMessage "Killing Node process on port 300x (PID: $p)" "Yellow"
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
    foreach ($p in $pythonPids) {
        Write-ColorMessage "Killing Python process on port 8000 (PID: $p)" "Yellow"
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
} else {
    $pids = Get-Content $pidFile
    $pidArray = $pids -split ','
    foreach ($p in $pidArray) {
        if ([string]::IsNullOrWhiteSpace($p)) { continue }
        Write-ColorMessage "Stopping process PID: $p" "Cyan"
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        # For npm we also need to kill child node processes
    }
    Remove-Item $pidFile -Force
    Write-ColorMessage "To ensure Vite is fully terminated, killing node..." "Cyan"
    $nodePids = Get-NetTCPConnection -LocalPort 3000, 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $nodePids) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}

Write-ColorMessage "All services stopped cleanly." "Green"
