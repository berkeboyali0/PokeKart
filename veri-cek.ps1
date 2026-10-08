# Tum Pokemon TCG kartlarini (fiyatlariyla) indirir ve data\cards.js dosyasina yazar.
# Kaynak: https://pokemontcg.io (kartlar, setler, fiyatlar) + https://pokeapi.co (Pokemon isimleri)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root 'data'
New-Item -ItemType Directory -Force $dataDir | Out-Null
$EUR_TO_USD = 1.08

function Get-Text([string]$url) {
    # pokemontcg.io sik sik rastgele 500/502 donduruyor; cok sayida kisa aralikli deneme yapiyoruz
    $max = 60
    for ($try = 1; $try -le $max; $try++) {
        try {
            $wc = New-Object System.Net.WebClient
            $wc.Encoding = [Text.Encoding]::UTF8
            $wc.Headers.Add('User-Agent', 'pokemon-card-game-local')
            return $wc.DownloadString($url)
        } catch {
            if ($try % 5 -eq 0) { Write-Host "    Sunucu hatasi, tekrar deneniyor ($try/$max)..." -ForegroundColor Yellow }
            Start-Sleep -Milliseconds (700 + [Math]::Min(10000, 300 * $try))
        }
    }
    throw "Indirilemedi: $url"
}
function Get-Json([string]$url) { return (Get-Text $url | ConvertFrom-Json) }

function Q([string]$s) {
    if ($null -eq $s) { return 'null' }
    $s = $s.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", ' ').Replace("`t", ' ')
    return '"' + $s + '"'
}

function Get-Price($c) {
    $cm = 0.0
    if ($c.cardmarket -and $c.cardmarket.prices) {
        $p = $c.cardmarket.prices
        foreach ($v in @($p.trendPrice, $p.avg30, $p.averageSellPrice, $p.avg7)) {
            if ($v -gt 0) { $cm = [double]$v * $EUR_TO_USD; break }
        }
    }
    if ($cm -gt 0) { return $cm }
    $tp = 0.0
    if ($c.tcgplayer -and $c.tcgplayer.prices) {
        foreach ($prop in $c.tcgplayer.prices.PSObject.Properties) {
            $v = $prop.Value
            $m = 0.0
            if ($v.market -gt 0) { $m = [double]$v.market } elseif ($v.mid -gt 0) { $m = [double]$v.mid }
            if ($m -gt $tp) { $tp = $m }
        }
    }
    return $tp
}

$inv = [Globalization.CultureInfo]::InvariantCulture

# ---- Setler ----
Write-Host 'Setler indiriliyor...' -ForegroundColor Cyan
$sets = (Get-Json 'https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=releaseDate').data
$setIndex = @{}
$setsOut = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $sets.Count; $i++) {
    $s = $sets[$i]
    $setIndex[$s.id] = $i
    $setsOut.Add("[$(Q $s.id),$(Q $s.name),$(Q $s.series),$(Q $s.releaseDate),$($s.total),$(Q $s.images.logo),$(Q $s.images.symbol)]")
}
Write-Host "  $($sets.Count) set bulundu."

# ---- Kartlar (set set indirilir; yarida kalirsa data\cache sayesinde kaldigi yerden devam eder) ----
$select = 'id,name,supertype,nationalPokedexNumbers,rarity,set,number,images,tcgplayer,cardmarket,subtypes'
$pageSize = 250
$cacheDir = Join-Path $dataDir 'cache'
New-Item -ItemType Directory -Force $cacheDir | Out-Null

$rarities = New-Object System.Collections.Generic.List[string]
$rarIndex = @{}
$cardsOut = New-Object System.Collections.Generic.List[string]
$seen = @{}

$allCards = New-Object System.Collections.Generic.List[object]
for ($si = 0; $si -lt $sets.Count; $si++) {
    $sid = $sets[$si].id
    Write-Host "  [$($si + 1)/$($sets.Count)] $($sets[$si].name)"
    $page = 1
    while ($true) {
        $file = Join-Path $cacheDir "$sid`_p$page.json"
        if (Test-Path $file) {
            $text = [IO.File]::ReadAllText($file, [Text.Encoding]::UTF8)
        } else {
            $text = Get-Text "https://api.pokemontcg.io/v2/cards?q=set.id:$sid&page=$page&pageSize=$pageSize&select=$select"
            [IO.File]::WriteAllText($file, $text, (New-Object Text.UTF8Encoding($false)))
            Start-Sleep -Milliseconds 200
        }
        $res = $text | ConvertFrom-Json
        foreach ($c in $res.data) { $allCards.Add($c) }
        if ($page * $pageSize -ge $res.totalCount) { break }
        $page++
    }
}
Write-Host "Toplam $($allCards.Count) kart indirildi, isleniyor..." -ForegroundColor Cyan

# ---- Illustration Rare listesi (pkmncards.com) ----
# pokemontcg.io bazi kartlarin nadirligini eksik/yanlis giriyor; IR/SIR icin pkmncards'i referans aliyoruz.
function ConvertTo-SetKey([string]$s) { return ($s -replace ':\s*Classic Collection$', '').Trim().ToLower() }
function ConvertTo-NameKey([string]$s) { return ([Net.WebUtility]::HtmlDecode($s).ToLower() -replace '[^a-z0-9]', '') }
$pkIllus = @{}
Write-Host 'Illustration kart listesi indiriliyor (pkmncards.com)...' -ForegroundColor Cyan
foreach ($slug in 'illustration-rare', 'special-illustration-rare') {
    for ($page = 1; $page -le 50; $page++) {
        $url = if ($page -eq 1) { "https://pkmncards.com/rarity/$slug/?display=list&sort=date&ord=auto" } else { "https://pkmncards.com/rarity/$slug/page/$page/?display=list&sort=date&ord=auto" }
        try {
            $wc = New-Object System.Net.WebClient
            $wc.Encoding = [Text.Encoding]::UTF8
            $wc.Headers.Add('User-Agent', 'Mozilla/5.0 (pokemon-card-game-local)')
            $html = $wc.DownloadString($url)
        } catch { break }   # son sayfadan sonra 404 doner
        $arts = [regex]::Matches($html, '<article .*?</article>', 'Singleline')
        if ($arts.Count -eq 0) { break }
        foreach ($a in $arts) {
            $t = $a.Value
            $setName = [Net.WebUtility]::HtmlDecode([regex]::Match($t, 'cell set"><span><abbr title="([^"]*)"').Groups[1].Value)
            $num = [regex]::Match($t, 'cell number"><span>([^<]*)</span>').Groups[1].Value
            $name = [regex]::Match($t, 'cell name"><a [^>]*>([^<]*)</a>').Groups[1].Value
            $rar = [regex]::Match($t, 'cell rarity"><span>([^<]*)</span>').Groups[1].Value
            if ($num -notmatch '^\d+$') { continue }
            $key = (ConvertTo-SetKey $setName) + '|' + [int]$num
            if (-not $pkIllus.ContainsKey($key)) { $pkIllus[$key] = New-Object System.Collections.Generic.List[object] }
            $pkIllus[$key].Add([pscustomobject]@{ name = (ConvertTo-NameKey $name); rarity = $rar; label = "$setName #$num $name"; used = $false })
        }
        Start-Sleep -Milliseconds 300
    }
}
$pkCount = 0; foreach ($v in $pkIllus.Values) { $pkCount += $v.Count }
Write-Host "  pkmncards: $pkCount illustration kart"
function Get-PkRarity($c) {
    if ($c.number -notmatch '^\d+$') { return $null }
    $list = $pkIllus[(ConvertTo-SetKey $c.set.name) + '|' + [int]$c.number]
    if (-not $list) { return $null }
    $n = ConvertTo-NameKey $c.name
    foreach ($e in $list) {
        if (-not $e.used -and ($n.StartsWith($e.name) -or $e.name.StartsWith($n))) { $e.used = $true; return $e.rarity }
    }
    return $null
}
$fixed = 0

foreach ($c in $allCards) {
    if ($seen.ContainsKey($c.id)) { continue }
    $seen[$c.id] = 1
    if (-not $setIndex.ContainsKey($c.set.id)) { continue }
    $r = if ($c.rarity) { $c.rarity } else { 'Promo' }
    $pkr = Get-PkRarity $c
    if ($pkr -and $pkr -ne $r) { $fixed++; Write-Host "  Nadirlik duzeltildi: $($c.set.name) #$($c.number) $($c.name): $r -> $pkr" -ForegroundColor DarkYellow; $r = $pkr }
    if (-not $rarIndex.ContainsKey($r)) { $rarIndex[$r] = $rarities.Count; $rarities.Add($r) }
    $dex = if ($c.nationalPokedexNumbers) { '[' + (($c.nationalPokedexNumbers | ForEach-Object { [int]$_ }) -join ',') + ']' } else { '0' }
    $st = 0
    if ($c.supertype -eq 'Trainer') { $st = 1 } elseif ($c.supertype -eq 'Energy') { $st = 2 }
    # trainer turu: S=Supporter, I=Item, D=Stadium, T=Pokemon Tool
    $sub = ''
    if ($st -eq 1 -and $c.subtypes) { $sts = @($c.subtypes); if ($sts -contains 'Supporter') { $sub = 'S' } elseif ($sts -contains 'Stadium') { $sub = 'D' } elseif ($sts -match 'Tool') { $sub = 'T' } else { $sub = 'I' } }
    $price = [Math]::Round((Get-Price $c), 2).ToString($inv)
    $img = [string]$c.images.small
    $img = $img.Replace('https://images.pokemontcg.io/', '')
    if ($img.EndsWith('.png')) { $img = $img.Substring(0, $img.Length - 4) }
    $cardsOut.Add("[$(Q $c.id),$(Q $c.name),$($setIndex[$c.set.id]),$(Q $c.number),$($rarIndex[$r]),$dex,$price,$(Q $img),$st,$(Q $sub)]")
}

$missing = foreach ($v in $pkIllus.Values) { foreach ($e in $v) { if (-not $e.used) { $e.label } } }
Write-Host "  pkmncards ile $fixed kartin nadirligi duzeltildi." -ForegroundColor Cyan
if ($missing) { Write-Host "  pokemontcg.io'da bulunamayan illustration kartlar ($(@($missing).Count)):" -ForegroundColor Yellow; $missing | ForEach-Object { Write-Host "    $_" } }

# ---- Pokemon isimleri ----
Write-Host 'Pokemon isimleri indiriliyor (PokeAPI)...' -ForegroundColor Cyan
$names = @{}
try {
    $sp = Get-Json 'https://pokeapi.co/api/v2/pokemon-species?limit=2000'
    foreach ($e in $sp.results) {
        $id = [int](($e.url.TrimEnd('/') -split '/')[-1])
        $names[$id] = $e.name
    }
} catch { Write-Host '  Isimler alinamadi, kart isimleri kullanilacak.' -ForegroundColor Yellow }
$maxId = 0
foreach ($k in $names.Keys) { if ($k -gt $maxId) { $maxId = $k } }
$namesOut = New-Object System.Collections.Generic.List[string]
for ($i = 1; $i -le $maxId; $i++) { $namesOut.Add((Q $names[$i])) }

# ---- Yaz ----
$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm')
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("// Otomatik olusturuldu: $stamp - elle duzenlemeyin, veri-guncelle.bat ile yenileyin`n")
[void]$sb.Append("window.POKE_DATA={generated:$(Q $stamp),`n")
[void]$sb.Append("sets:[`n" + ($setsOut -join ",`n") + "],`n")
[void]$sb.Append("rarities:[" + (($rarities | ForEach-Object { Q $_ }) -join ',') + "],`n")
[void]$sb.Append("species:[" + ($namesOut -join ',') + "],`n")
[void]$sb.Append("cards:[`n" + ($cardsOut -join ",`n") + "]};`n")
$outFile = Join-Path $dataDir 'cards.js'
[IO.File]::WriteAllText($outFile, $sb.ToString(), (New-Object Text.UTF8Encoding($false)))
Remove-Item -Recurse -Force $cacheDir
Write-Host "Tamam! $($cardsOut.Count) kart -> $outFile" -ForegroundColor Green
