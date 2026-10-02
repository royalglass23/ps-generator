$prototypeDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "PS1 prototype: http://localhost:4173/?variant=A"
python -m http.server 4173 --directory $prototypeDirectory
