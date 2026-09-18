# setup.ps1 - Setup embedded Python and dependencies for Pixelator
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$PythonDir = Join-Path $ProjectRoot "python"
$ZipPath = Join-Path $ProjectRoot "python-embed.zip"
$GetPipPath = Join-Path $ProjectRoot "get-pip.py"
$ModelsDir = Join-Path $ProjectRoot "models"

Write-Host "===================================================="
Write-Host "Setting up Embedded Python in: $PythonDir"
Write-Host "===================================================="

# 1. Download & Extract Embedded Python 3.11.9 if not already extracted
if (-not (Test-Path (Join-Path $PythonDir "python.exe"))) {
    $PythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
    Write-Host "[1/5] Downloading Embedded Python 3.11.9..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $PythonUrl -OutFile $ZipPath -UseBasicParsing

    Write-Host "[1/5] Extracting Python to $PythonDir..."
    if (-not (Test-Path $PythonDir)) {
        New-Item -ItemType Directory -Path $PythonDir | Out-Null
    }
    Expand-Archive -Path $ZipPath -DestinationPath $PythonDir -Force
    Remove-Item -Path $ZipPath -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "[1/5] Embedded Python already exists."
}

# 2. Enable 'import site' in python311._pth
$PthFile = Join-Path $PythonDir "python311._pth"
if (Test-Path $PthFile) {
    Write-Host "[2/5] Configuring python311._pth to enable site-packages..."
    $content = Get-Content $PthFile
    $newContent = $content -replace "^#import site", "import site"
    if (-not ($newContent -match "(?m)^import site")) {
        $newContent += "`nimport site"
    }
    Set-Content -Path $PthFile -Value $newContent
}

# 3. Download & Install pip
$PythonExe = Join-Path $PythonDir "python.exe"
$PipExe = Join-Path $PythonDir "Scripts\pip.exe"

if (-not (Test-Path $PipExe)) {
    Write-Host "[3/5] Downloading get-pip.py..."
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $GetPipPath -UseBasicParsing

    Write-Host "[3/5] Installing pip..."
    & $PythonExe $GetPipPath --no-warn-script-location
    Remove-Item -Path $GetPipPath -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "[3/5] Pip is already installed."
}

# 4. Install Python dependencies
$ReqPath = Join-Path $ProjectRoot "requirements.txt"
if (Test-Path $ReqPath) {
    Write-Host "[4/5] Installing packages from requirements.txt..."
    & $PythonExe -m pip install -r $ReqPath --no-warn-script-location
}

# 5. Download Lightweight Super-Resolution Models (FSRCNN)
if (-not (Test-Path $ModelsDir)) {
    New-Item -ItemType Directory -Path $ModelsDir | Out-Null
}

$Models = @(
    @{ Name = "FSRCNN_x2.pb"; Url = "https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x2.pb" },
    @{ Name = "FSRCNN_x3.pb"; Url = "https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x3.pb" },
    @{ Name = "FSRCNN_x4.pb"; Url = "https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x4.pb" },
    @{ Name = "ESPCN_x2.pb";  Url = "https://raw.githubusercontent.com/fannymonori/TF-ESPCN/master/export/ESPCN_x2.pb" },
    @{ Name = "ESPCN_x4.pb";  Url = "https://raw.githubusercontent.com/fannymonori/TF-ESPCN/master/export/ESPCN_x4.pb" }
)

Write-Host "[5/5] Checking lightweight AI Super-Resolution models..."
foreach ($m in $Models) {
    $TargetModel = Join-Path $ModelsDir $m.Name
    if (-not (Test-Path $TargetModel)) {
        Write-Host "  Downloading $($m.Name)..."
        try {
            Invoke-WebRequest -Uri $m.Url -OutFile $TargetModel -UseBasicParsing -TimeoutSec 15
        } catch {
            Write-Warning "  Could not download $($m.Name): $_"
        }
    }
}

Write-Host "===================================================="
Write-Host "Setup Completed Successfully!"
Write-Host "===================================================="
