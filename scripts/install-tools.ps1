# Optional: install advanced scanner binaries used in later phases.
# The core SiteAudit engine (crawl, headers, TLS, endpoints, secrets, exposures)
# works WITHOUT these. They add known-CVE scanning (nuclei), tech fingerprinting
# depth (whatweb), and aggressive enumeration (gobuster).

Write-Host "SiteAudit optional tool installer (Windows)"
Write-Host "The built-in engine needs no external binaries. These are OPTIONAL extras."
Write-Host ""

$go = Get-Command go -ErrorAction SilentlyContinue
if (-not $go) {
  Write-Host "[skip] Go not installed - httpx/katana/nuclei/gobuster need it (or use prebuilt binaries)."
  Write-Host "       Get Go at https://go.dev/dl/"
} else {
  Write-Host "[1/4] installing httpx..."
  go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest 2>&1 | Out-Null
  Write-Host "[2/4] installing katana..."
  go install -v github.com/projectdiscovery/katana/cmd/katana@latest 2>&1 | Out-Null
  Write-Host "[3/4] installing nuclei..."
  go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest 2>&1 | Out-Null
  Write-Host "[4/4] installing gobuster..."
  go install -v github.com/OJ/gobuster/v3@latest 2>&1 | Out-Null
  Write-Host "Done. Binaries are in %USERPROFILE%\go\bin - add it to PATH."
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "  npm install"
Write-Host "  npm run dev   (starts API on :4000 + web on :5173)"
Write-Host "  open http://localhost:5173"
