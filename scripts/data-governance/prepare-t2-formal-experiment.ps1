param(
  [Parameter(Mandatory = $true)]
  [string]$SourceRoot,
  [Parameter(Mandatory = $true)]
  [string]$OutputRoot,
  [switch]$OwnerConfirmed
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression

$questionIds = @('T2-1', 'T2-2', 'T2-3', 'O2')
$maxScores = @(20, 20, 20, 40)
$scoreParagraphs = @(8, 13, 18, 23)
$annotationParagraphs = @(9, 14, 19, 24)
$datasetId = 't2-formal-first-round-20260813'
$datasetVersion = 'v1-half-point-20-20-20-40'

function Get-Sha256([string]$Path) {
  $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    $digest = $algorithm.ComputeHash($stream)
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
  return "sha256:$(([BitConverter]::ToString($digest) -replace '-', '').ToLowerInvariant())"
}

function Assert-FileSignature([string]$Path, [string]$ExpectedKind) {
  $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  try {
    $header = New-Object byte[] 4096
    $read = $stream.Read($header, 0, $header.Length)
  } finally {
    $stream.Dispose()
  }
  if ($ExpectedKind -eq 'docx') {
    if ($read -lt 4 -or $header[0] -ne 0x50 -or $header[1] -ne 0x4B) {
      throw 'Submission content is not an OOXML ZIP document.'
    }
    $zipStream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
      $archive = New-Object IO.Compression.ZipArchive($zipStream, [IO.Compression.ZipArchiveMode]::Read, $false)
      try {
        $entryNames = @($archive.Entries | ForEach-Object FullName)
        if ('[Content_Types].xml' -notin $entryNames -or 'word/document.xml' -notin $entryNames) {
          throw 'Submission ZIP does not contain required OOXML Word parts.'
        }
      } finally {
        $archive.Dispose()
      }
    } catch {
      throw 'Submission content is not a readable OOXML Word document.'
    } finally {
      $zipStream.Dispose()
    }
    return 'OOXML_ZIP'
  }
  $ole = @(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)
  if ($read -ge 8 -and -not (Compare-Object $ole $header[0..7] -SyncWindow 0)) {
    return 'OLE_WORD'
  }
  $prefix = [Text.Encoding]::UTF8.GetString($header, 0, $read).TrimStart([char]0xFEFF)
  if ($prefix -match '^<\?xml\b' -and $prefix -match 'pkg:package|wordprocessingml|<w:wordDocument\b') {
    return 'WORD_XML'
  }
  throw 'Score record content is not a recognized Word document representation.'
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

$expectedSampleNames = @(1..40 | ForEach-Object { 'sample-{0:D3}' -f $_ })
$samples = @(Get-ChildItem -LiteralPath $SourceRoot -Directory -Filter 'sample-*' | Sort-Object Name)
$actualSampleNames = @($samples | ForEach-Object Name)
if ($samples.Count -ne 40 -or (Compare-Object $expectedSampleNames $actualSampleNames -SyncWindow 0)) {
  throw 'Sample directories must be the exact continuous sequence sample-001 through sample-040.'
}

$authoritativeRubric = Join-Path $SourceRoot 'T2S-20.md'
if (-not (Test-Path -LiteralPath $authoritativeRubric -PathType Leaf)) {
  throw 'The authoritative rubric T2S-20.md is missing.'
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$baselineSamples = @()
$manifestSamples = @()
$inventory = @()
$scoreRecordInventory = @()

try {
  foreach ($sample in $samples) {
    if ($sample.Name -notmatch '^sample-[0-9]{3}$') {
      throw "Invalid sample ID: $($sample.Name)"
    }
    $sampleId = "sample-$($sample.Name.Substring(7).PadLeft(4, '0'))"

    $allFiles = @(Get-ChildItem -LiteralPath $sample.FullName -File)
    $expectedAnswerFiles = @('O2.docx', 'T2-1.docx', 'T2-2.docx', 'T2-3.docx')
    $actualAnswerFiles = @($allFiles | Where-Object Extension -EQ '.docx' | Sort-Object Name | ForEach-Object Name)
    if ($actualAnswerFiles.Count -ne 4 -or (Compare-Object $expectedAnswerFiles $actualAnswerFiles -SyncWindow 0)) {
      throw "$sampleId must contain exactly the four authoritative answer files."
    }
    $recordFiles = @($allFiles | Where-Object Extension -EQ '.doc')
    if ($recordFiles.Count -ne 1) {
      throw "$($sample.Name) must contain exactly one .doc score record."
    }
    if ($allFiles.Count -ne 5) {
      throw "$sampleId contains undeclared files."
    }
    $recordKind = Assert-FileSignature $recordFiles[0].FullName 'doc'
    $scoreRecordInventory += [ordered]@{
      sampleId = $sampleId
      logicalSource = "score-records/$sampleId.doc"
      sourceChecksum = Get-Sha256 $recordFiles[0].FullName
      sourceReadOnly = [bool]$recordFiles[0].IsReadOnly
      detectedType = $recordKind
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
      $teacherAnnotations = @($annotationParagraphs | ForEach-Object {
        ($document.Paragraphs.Item($_).Range.Text -replace '[\r\a]+$', '').Trim()
      })
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
      $submissionKind = Assert-FileSignature $submission 'docx'
      $logicalPath = "submissions/$sampleId/$questionId.docx"
      $checksum = Get-Sha256 $submission
      $annotations = if ([string]::IsNullOrWhiteSpace($teacherAnnotations[$index])) { @() } else { @($teacherAnnotations[$index]) }
      $questions += [ordered]@{
        questionId = $questionId
        maxScore = $maxScore
        teacherScore = $score
        teacherAnnotations = @($annotations)
        deductions = @()
      }
      $submissions += [ordered]@{ questionId = $questionId; path = $logicalPath; checksum = $checksum }
      $inventory += [ordered]@{
        sampleId = $sampleId
        sourceSampleDirectory = $sample.Name
        questionId = $questionId
        logicalSource = $logicalPath
        sourceChecksum = $checksum
        sourceReadOnly = [bool](Get-Item -LiteralPath $submission).IsReadOnly
        detectedType = $submissionKind
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
  question = [ordered]@{ path = 'T2S-20.md'; checksum = Get-Sha256 $authoritativeRubric }
  baseline = [ordered]@{ path = 'baseline.json'; checksum = $null }
  assets = @()
  samples = $manifestSamples
}

$baselinePath = Join-Path $OutputRoot 'baseline.draft.json'
$manifestPath = Join-Path $OutputRoot 'manifest.draft.json'
$inventoryPath = Join-Path $OutputRoot 'redaction-review-inventory.json'
$scoreRecordInventoryPath = Join-Path $OutputRoot 'score-record-inventory.json'
$baselineDraft | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $baselinePath
$manifestDraft | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $manifestPath
$inventory | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $inventoryPath
$scoreRecordInventory | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $scoreRecordInventoryPath
$writableSourceCount = @($inventory + $scoreRecordInventory | Where-Object { -not $_.sourceReadOnly }).Count

$packagePath = $null
if ($OwnerConfirmed) {
  if ($writableSourceCount -gt 0) {
    throw "Formal package creation requires every source file to be read-only; found $writableSourceCount writable files."
  }
  $contentsRoot = Join-Path $OutputRoot 'contents'
  if (Test-Path -LiteralPath $contentsRoot) {
    Remove-Item -LiteralPath $contentsRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Join-Path $contentsRoot 'assets') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $contentsRoot 'submissions') | Out-Null
  Copy-Item -LiteralPath $authoritativeRubric -Destination (Join-Path $contentsRoot 'T2S-20.md')
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
  scoreRecordInventoryPath = $scoreRecordInventoryPath
  packagePath = $packagePath
  packageReady = [bool]($OwnerConfirmed -and $writableSourceCount -eq 0)
  blockedBy = if ($writableSourceCount -gt 0) {
    "$writableSourceCount source files are writable"
  } elseif (-not $OwnerConfirmed) {
    '160 owner redaction confirmations'
  } else {
    $null
  }
} | ConvertTo-Json -Depth 4
