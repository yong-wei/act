param(
  [Parameter(Mandatory = $true)]
  [string]$SourceRoot,
  [Parameter(Mandatory = $true)]
  [string]$OutputRoot,
  [switch]$OwnerConfirmed
)

$ErrorActionPreference = 'Stop'

$questionIds = @('T2-1', 'T2-2', 'T2-3', 'O2')
$maxScores = @(20, 20, 20, 40)
$scoreParagraphs = @(8, 13, 18, 23)
$datasetId = 't2-formal-first-round-20260813'
$datasetVersion = 'v1-half-point-20-20-20-40'

function Get-Sha256([string]$Path) {
  return "sha256:$((Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant())"
}

function Get-ScoreBand([double]$TotalScore) {
  if ($TotalScore -lt 60) { return 'low' }
  if ($TotalScore -lt 70) { return 'middle-low' }
  if ($TotalScore -lt 80) { return 'middle' }
  if ($TotalScore -lt 90) { return 'middle-high' }
  return 'high'
}

if (-not (Test-Path -LiteralPath $SourceRoot -PathType Container)) {
  throw "Source root does not exist: $SourceRoot"
}

$samples = Get-ChildItem -LiteralPath $SourceRoot -Directory -Filter 'sample-*' | Sort-Object Name
if ($samples.Count -ne 40) {
  throw "Expected exactly 40 samples, found $($samples.Count)."
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$baselineSamples = @()
$manifestSamples = @()
$inventory = @()

try {
  foreach ($sample in $samples) {
    if ($sample.Name -notmatch '^sample-[0-9]{3}$') {
      throw "Invalid sample ID: $($sample.Name)"
    }
    $sampleId = "sample-$($sample.Name.Substring(7).PadLeft(4, '0'))"

    $recordFiles = @(Get-ChildItem -LiteralPath $sample.FullName -File -Filter '*.doc')
    if ($recordFiles.Count -ne 1) {
      throw "$($sample.Name) must contain exactly one .doc score record."
    }

    $document = $word.Documents.Open($recordFiles[0].FullName, $false, $true)
    try {
      if ($document.Paragraphs.Count -ne 26) {
        throw "$sampleId score record has unexpected paragraph count $($document.Paragraphs.Count)."
      }
      $scores = @()
      foreach ($paragraphIndex in $scoreParagraphs) {
        $value = ($document.Paragraphs.Item($paragraphIndex).Range.Text -replace '[^0-9\.]', '')
        if ($value -notmatch '^[0-9]+(?:\.5)?$') {
          throw "$sampleId paragraph $paragraphIndex does not contain one score."
        }
        $scores += [double]::Parse($value, [Globalization.CultureInfo]::InvariantCulture)
      }
    } finally {
      $document.Close($false)
    }

    $questions = @()
    $submissions = @()
    for ($index = 0; $index -lt $questionIds.Count; $index++) {
      $questionId = $questionIds[$index]
      $score = $scores[$index]
      $maxScore = $maxScores[$index]
      if ($score -lt 0 -or $score -gt $maxScore -or [Math]::Abs($score * 2 - [Math]::Round($score * 2)) -gt 0.000000001) {
        throw "$sampleId $questionId has invalid score $score."
      }
      $submission = Join-Path $sample.FullName "$questionId.docx"
      if (-not (Test-Path -LiteralPath $submission -PathType Leaf)) {
        throw "$sampleId is missing $questionId.docx."
      }
      $logicalPath = "submissions/$sampleId/$questionId.docx"
      $checksum = Get-Sha256 $submission
      $questions += [ordered]@{ questionId = $questionId; maxScore = $maxScore; teacherScore = $score; deductions = @() }
      $submissions += [ordered]@{ questionId = $questionId; path = $logicalPath; checksum = $checksum }
      $inventory += [ordered]@{
        sampleId = $sampleId
        sourceSampleDirectory = $sample.Name
        questionId = $questionId
        sourceFile = $submission
        sourceChecksum = $checksum
        reviewStatus = if ($OwnerConfirmed) { 'CONFIRMED' } else { 'REVIEW_REQUIRED' }
      }
    }

    $totalScore = ($scores | Measure-Object -Sum).Sum
    $baselineSamples += [ordered]@{
      sampleId = $sampleId
      cleanupConfirmed = [bool]$OwnerConfirmed
      baselineConfirmed = $true
      questions = $questions
      totalScore = $totalScore
    }
    $manifestSamples += [ordered]@{
      sampleId = $sampleId
      submissions = $submissions
      scoreBand = Get-ScoreBand $totalScore
      primaryErrorType = 'unclassified'
    }
  }
} finally {
  $word.Quit()
}

$baselineDraft = [ordered]@{
  schemaVersion = 'teacher-ai-grading-package-baseline.v1'
  datasetId = $datasetId
  datasetVersion = $datasetVersion
  gradingBasis = 'teacher-score-only'
  samples = $baselineSamples
}
$manifestDraft = [ordered]@{
  schemaVersion = 'teacher-ai-grading-package-manifest.v1'
  datasetId = $datasetId
  datasetVersion = $datasetVersion
  datasetKind = 'first-round'
  question = [ordered]@{ path = 'T2S-20.md'; checksum = Get-Sha256 (Join-Path $SourceRoot 'T2S-20.md') }
  baseline = [ordered]@{ path = 'baseline.json'; checksum = $null }
  assets = @()
  samples = $manifestSamples
}

$baselinePath = Join-Path $OutputRoot 'baseline.draft.json'
$manifestPath = Join-Path $OutputRoot 'manifest.draft.json'
$inventoryPath = Join-Path $OutputRoot 'redaction-review-inventory.json'
$baselineDraft | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $baselinePath
$manifestDraft | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $manifestPath
$inventory | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $inventoryPath

$packagePath = $null
if ($OwnerConfirmed) {
  $contentsRoot = Join-Path $OutputRoot 'contents'
  if (Test-Path -LiteralPath $contentsRoot) {
    Remove-Item -LiteralPath $contentsRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Join-Path $contentsRoot 'assets') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $contentsRoot 'submissions') | Out-Null
  Copy-Item -LiteralPath (Join-Path $SourceRoot 'T2S-20.md') -Destination (Join-Path $contentsRoot 'T2S-20.md')
  if (Test-Path -LiteralPath (Join-Path $SourceRoot 'assets')) {
    Copy-Item -Path (Join-Path $SourceRoot 'assets\*') -Destination (Join-Path $contentsRoot 'assets') -Recurse
  }
  foreach ($sample in $samples) {
    $sampleId = "sample-$($sample.Name.Substring(7).PadLeft(4, '0'))"
    $destination = Join-Path $contentsRoot "submissions\$sampleId"
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    foreach ($questionId in $questionIds) {
      Copy-Item -LiteralPath (Join-Path $sample.FullName "$questionId.docx") -Destination (Join-Path $destination "$questionId.docx")
    }
  }

  $baselineFinal = [ordered]@{
    schemaVersion = $baselineDraft.schemaVersion
    datasetId = $datasetId
    datasetVersion = $datasetVersion
    gradingBasis = 'teacher-score-only'
    samples = @($baselineSamples | ForEach-Object {
      [ordered]@{
        sampleId = $_.sampleId
        cleanupConfirmed = $true
        baselineConfirmed = $true
        questions = $_.questions
      }
    })
  }
  $baselineFinalPath = Join-Path $contentsRoot 'baseline.json'
  $baselineFinal | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $baselineFinalPath

  $assets = @(Get-ChildItem -LiteralPath (Join-Path $contentsRoot 'assets') -File -Recurse | Sort-Object FullName | ForEach-Object {
    $relative = $_.FullName.Substring($contentsRoot.Length + 1).Replace('\', '/')
    [ordered]@{ path = $relative; checksum = Get-Sha256 $_.FullName }
  })
  $manifestFinal = [ordered]@{
    schemaVersion = $manifestDraft.schemaVersion
    datasetId = $datasetId
    datasetVersion = $datasetVersion
    datasetKind = 'first-round'
    question = $manifestDraft.question
    baseline = [ordered]@{ path = 'baseline.json'; checksum = Get-Sha256 $baselineFinalPath }
    assets = $assets
    samples = $manifestSamples
  }
  $manifestFinal | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $contentsRoot 'manifest.json')
  $packagePath = Join-Path $OutputRoot 't2-formal-first-round-v1.grading-lab.zip'
  if (Test-Path -LiteralPath $packagePath) {
    Remove-Item -LiteralPath $packagePath -Force
  }
  Add-Type -AssemblyName System.IO.Compression
  $stream = [IO.File]::Open($packagePath, [IO.FileMode]::CreateNew)
  $archive = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
  try {
    foreach ($file in Get-ChildItem -LiteralPath $contentsRoot -File -Recurse | Sort-Object FullName) {
      $entryName = $file.FullName.Substring($contentsRoot.Length + 1).Replace('\', '/')
      $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
      $entryStream = $entry.Open()
      $sourceStream = [IO.File]::OpenRead($file.FullName)
      try {
        $sourceStream.CopyTo($entryStream)
      } finally {
        $sourceStream.Dispose()
        $entryStream.Dispose()
      }
    }
  } finally {
    $archive.Dispose()
    $stream.Dispose()
  }
}

[ordered]@{
  datasetId = $datasetId
  datasetVersion = $datasetVersion
  sampleCount = $samples.Count
  submissionCount = $inventory.Count
  baselinePath = $baselinePath
  manifestPath = $manifestPath
  reviewInventoryPath = $inventoryPath
  packagePath = $packagePath
  packageReady = [bool]$OwnerConfirmed
  blockedBy = if ($OwnerConfirmed) { $null } else { '160 owner redaction confirmations' }
} | ConvertTo-Json -Depth 4
