# Ajan panosu — yol haritası

Hedef: Claude Code'u görsel ve etkileşimli olarak canlandırmak, ama her parça gerçekten işe yarasın.
Her adım ayrı bir sürüm (git commit); beğenilmezse geri alınır.

## İlkeler (görüş)
- Hareket bilgi taşır: bir şey değişince oynar; sürekli hareket yalnız küçük, kenardaki öğelerde.
- Sohbet okunabilir kalır: transcript'teki süs, metni itmez, satır boyunu büyütmez.
- Panel yalnız olay olunca (ajan başlar/biter, kart düğmesi) yeniden çizilir; her çizim maskot SVG'lerini baştan yükler,
  animasyon saate bağlı sürer.
- Ses ve kutlama varsayılan kapalı.
- Hareketi azaltma seçeneği istenmedi (Burak: "pc zaten çok güçlü").
- Yeniden başlatmaya dayanıklı olmayan sayı gösterme (panonun state'i uygulama açılınca sıfırlanır).
- Sık değişen yazı Client bölgesinde; panel yalnız ajan başlarken/biterken çizilir (v0.4.5).

## Adımlar
1. [x] v0.4 Spinner maskotu — "Working" satırında Claude'un mini maskotu + ne yaptığı. (küçük)
2. [x] v0.5 Araç satırları — adım satırına araç simgesi (çalışırken hareketli); "Ajan" satırına
   alt ajanın mini maskotu. Alt ajanın kendi adımları sohbette çizilmediği için renk yalnız ajan satırında. (orta)
3. [x] v0.6 Prompt üstü bant — çalışan ajanların mini maskotları yan yana; "Panel" düğmesi;
   hepsi bitince "✓ n ajan bitti" + kapat. (orta)
4. [x] v0.7 Tıklanabilir kartlar — karta tıklayınca son adımlar, sonucun ilk satırları,
   "sonucu prompt'a al" butonu. (orta-büyük)
5. [x] v0.8 Tur sonu özeti — süre, araç, alt ajan, düzenlenen dosyalar (başarılı Edit/Write/NotebookEdit,
   alt ajanlarınki dahil), bağlam. Panelde "Son tur" satırı; masaüstünde bantta da (✕ ya da yeni turla gizlenir).
   Terminal bandında yok: TurnDuration satırı orada zaten var. (küçük)
6. [x] v0.9 Ses ve kutlama — dalga (bantta birlikte çalışan ajanlar) bitince tek çan, sorun varsa alçalan ton
   (`sounds/*.wav`, betikle üretildi); sorunsuz bitince bantta bir kez konfeti (SMIL, döngüsüz, bitişten sonraki
   3 sn içinde çizilir). `/pano ses`, `/pano kutlama`; `$.store` 'ayarlar'da kalıcı. (küçük)
7. [-] v1.0 Temalar — elendi (fikir turu, 2026-10-10; aşağıya bak).

## Durum (2026-10-10 sonu) — sıradaki oturum buradan başlar
- Sürüm 0.9.52, kurulu, Burak gerçek uygulamada denedi. Açık iş yok; yeni iş Burak'tan gelir. Sürüm sürüm ayrıntı:
  `git log` (her commit bir sürüm, mesajında ne ve neden).
- Bu oturumda eklenen ve Burak'ın doğruladığı (0.9.18–0.9.49):
  - Uyku pozu ~16 sn'de bir uyanır, sıçrar, sola sağa bakar, yeniden uyur (z'ler uyanıkken söner).
  - Genel amaçlı ajan camgöbeği, başı saran düz baret + İngiliz anahtarı (turuncu aileden ayrıldı; yatık baret çirkin).
  - Durum rozeti her ajanda sol üstte; eşyalar sağ elde (tahta ve harita aynalandı).
  - Animasyonlar duvar saatine bağlı (`inPhase`): yeniden çizimde baştan başlamaz.
  - Kart ve bantta uzun satır çerçeveden taşmaz (`minWidth 0` + `overflow hidden`).
  - Sohbetteki "Çalışıyor…" maskotu ajan satırı maskotuyla aynı boy ve sütunda (20 px kutu, 1 hücre sola, ince ayar ölçülerek).
  - Kart: "Detay ▼/▲"; açılınca sekmeler Prompt (ajana verilen görev) · Adımlar · Rapor, metin kesilmeden; açık
    sekmeye yeniden basmak kapatır; raporda "Prompt'a al" / "Kopyala". Düğmeler panelin yerel düğmeleri, tek tıklamada
    çalışır (aşağıda "Panel düğmesi kuralları"). Yazı iki Client'ta (`card.tsx` head/body).
  - Çalışan kartta "Durdur ■": `$.tool.call` TaskStop (task_id = ajan kimliği), olmazsa `$.turn.abort`. Gerçek arka plan
    ajanını durdurdu, kart "durduruldu" oldu.
  - Kalıcı kartlar yeniden başlatmada geri geliyor (doğrulandı).
- Sıradaki aday (öneri, Burak'a sunuldu, cevap bekliyor): alt ajan kartında "rapor ↔ yapılanlar" farkı — raporda
  geçmeyen düzenlemeleri nötr bir satırla göstermek (onay işareti değil; kaynak: arXiv 2609.12205, 2602.16844).
  Diğer adaylar: tekrar/takılma uyarısı (aynı komut üst üste hata), aynı dosyayı iki ajanın düzenlemesi uyarısı.
- Çalışma usulü: her sürümden sonra `claude plugin marketplace update burak-mods && claude plugin update
  ajan-panosu@burak-mods`, Burak uygulamayı kapatıp açar (`/reload-plugins` mod güncellemesini yüklemedi, 2026-10-10:
  "0 hooks", taşma düzeltmesi görünmedi). Commit'i test geçmesine bağla (`claude plugin test . | grep -q " 0 fail" &&
  git commit …`). Görsel değişikliği göndermeden önce tarayıcı önizlemesinde gerçek boyutta bak (scratchpad'de
  `node --experimental-strip-types` ile `mascotSvg` → HTML, yerel http.server + preview; `pauseAnimations` +
  `setCurrentTime` ile kare kare). Ekranda ölçülmesi gereken hizalama için Burak'tan ekran görüntüsü iste.
- Tıklama/olay sorunlarında: `$.store`'a sessiz kayıt yaz, `~/.claude/plugins/store/ajan-panosu_*.json`'dan oku
  (Burak'a ekran görüntüsü aldırmaktan iyi; ekran görüntüsü almak paneli odaktan çıkarıp ölçümü bozuyordu).

## Açık işler — kapandı (2026-10-10)
- v0.7.2–0.7.4: kart ayrıntısı `hooks/card.tsx` Client'ında (aç/kapa state yazmaz, takılma gitti); başlıkta sabit
  simgeler ▸ ↵ ⧉, bantta ☰ ✕; rapor önizlemesi düz yazı. Burak gerçek uygulamada denedi: çalışıyor.
- Uygulamanın "•••" / dört nokta göstergeleri kalıyor (Burak: "noktalar kalsın").
- `/pano sakin` yapılmayacak (Burak, 2026-10-10: "pc zaten çok güçlü"). Sıra: v1.0 tema.

## Fikir turu (2026-10-10, iki ajan: kod + web) — sonuç
- Yapıldı: v0.9.6 alt ajan satırında şu anki adım (araç süresi, "düşünüyor", 60 sn uyarı); v0.9.7 Claude kartında bağlam çubuğu (v0.9.9'da kaldırıldı, Burak: bağlam üç yerde yazıyordu; sıkıştırma notu kaldı); v0.9.8 bant her an tek konu, sohbetteki Ajan
  satırı arka plan ajanında gerçek durumu gösterir, "Seni bekliyor · n ajan arka planda".
- Elendi: v1.0 tema (bilgi taşımaz, renk = ajan tipi eşleşmesini bozar; koyu temada okunurluk iyi), işe göre poz
  (yeniden çizim/takılma), zaman çizelgesi, rozet/istatistik, limit/maliyet satırı (`/cost` var).
- Elendi sonradan: panelde sabit başlık (Claude üstte, kartlar `ui.scroll` ile kendisi kayar; v0.9.28 denendi,
  Burak beğenmedi, 2026-10-10). Masaüstünde tekerlek `ui.scroll` olarak geliyor (ölçüldü).
- Elendi sonradan: tur özetini makbuza çevirmek (+/− satır, "test çalışmadı") — Burak beğenmedi (2026-10-10).
- Sonraya (öneri, doğrulanmadı): "seni bekliyor" izin uyarısı (API'nin izin beklemeyi görüp görmediği ölçülmeli;
  kod ajanı uygulamanın kendi diyaloğu yeter dedi). Tek ajanı durdurma düğmesi yapıldı (v0.9.47). Kaynaklar:
  https://github.com/lorenzh/rabe · https://github.com/hoobnn/hoobnn-agent-mods ·
  https://github.com/anthropics/claude-code/issues/28962 · https://www.nngroup.com/articles/animation-usability/
- Boştayken Client sorusu gelmiyorsa arka plan ajanının süre sayacı donmuş görünebilir (ölçülmedi).

## Geliştirme notları (yeni oturum için)
- Uzun panelde kaydırma sıçraması (2026-10-10, v0.9.50–0.9.52): `ui.scroll` olayları 10–20 ms arayla ±1/±2 satır
  ters işaretle kendini besliyordu (196 olayın 170'i), içerik boyu sabit (96 satır, pencere 44); sebep boyut
  kısalması değil motor–ekran salınımıydı. Çözüm: `ui.scroll` hook'u 120 ms içinde ters yönde gelen ≤3 satırlık
  hareketi yutar (`offset - by`); düzeltme sonrası izde 204 olayın 1'i yutuldu, Burak: çözüldü. Teşhis yöntemi:
  hook'ta `e.offset/by/contentRows`'u `$.store`'a yazıp dosyadan okumak. Tekerlek olayı bir hook'tan geçer, hook'a
  `await` koymak olayları birleştirmeyi etkileyebilir; sorun dönerse önce `SCROLL_FLIP_MS/ROWS`'a bak.
- Panonun state'i uygulama yeniden başlayınca sıfırlanır (sohbet sürse de). Oturum sayaçları ("n tur · n araç")
  bu yüzden yanıltıcıydı, v0.9.11'de kaldırıldı (Burak). Yeniden başlatmaya dayanıklı olmayan sayı gösterme.
- Alt ajan arka planda iş bırakıp turunu bitirebilir (turn.complete gelir), sonra kendiliğinden devam eder
  (ölçüm, 2026-10-10: `sleep 65` arka plana atıldı). v0.9.10: biten karta araç gelirse kart ve bant yeniden
  "çalışıyor"; bitiş çanı gerçek bitişte yeniden çalar.
- Masaüstünde Client'ın `surface.every` sorusu boştayken gelmiyor olabilir (tur bitince panelde "Düşünüyor…"
  takılı kaldı, 2026-10-10; doğrulanmadı). Çözüm: panel yeniden çizilirken (`setPose`) canlı bölgeye güncel
  satır verilir. Boştayken değişen yazıyı yalnız Client sorusuna bırakma.
- Masaüstünde Client içinde `Markdown` çizilemiyor (ölçüm, 2026-10-10, v0.7.3): kart "returned a tree the page
  cannot draw" deyip bozuldu, yeniden yüklenene kadar dönmedi. Testler bunu yakalamıyor. Client'ta yalnız
  Box/Text/Button kullan. `ui.fault` hook'u sebebi bildirimle gösterir (v0.7.4).
- Kurulum güncellemesi oturuma uygulama yeniden başlatılınca yansır; `/reload-plugins` yetmedi (2026-10-10).
- Kalıcı kurulum bu klasörden DEĞİL, kurulum anındaki kopyadan okunur (`~/.claude/plugins/cache/burak-mods/
  ajan-panosu/<sürüm>`; `claude plugin list`'teki "Read from" yanıltıcı). 2026-10-10'a kadar oturumlar v0.1.0
  kopyasını yüklüyordu: maskot, bant, adım simgeleri hiç görünmüyordu. Her sürümden sonra:
  `claude plugin marketplace update burak-mods && claude plugin update ajan-panosu@burak-mods`, sonra uygulamayı
  yeniden başlat (çıktı "Restart to apply changes" diyor). Testler: `claude plugin test .`,
  doğrulama: `claude plugin validate .`. Tip kontrolü: motor `.claude-plugin/types/` altına tipleri yazar.
- Pane'in `isFocused` alanı tıklamayla değişir, bu da paneli yeniden çizdirir (her çizim SVG'yi baştan yükler);
  animasyon sürekliliği `inPhase(svg, await $.clock.now())` ile sağlanır, yeni maskot çağrısında unutma.
- Yazı sütunu olan her esnek kutuya `minWidth={0} overflow="hidden"` ver: yoksa `truncate-end` satırı kutuyu
  genişletir ve "…" kartın çerçevesinden taşar (masaüstü, CSS flex min-width:auto).
- Panel düğmesi kuralları (v0.9.40–0.9.48, ölçülerek): odaksız panelde ilk tıklama = `ui.focus` (+ isFocused çizimi),
  `ui.press` ya gelmez ya ~0,4–0,6 sn geç gelir; odaktaki panelde `ui.press` + ~25 ms sonra `ui.focus`. Eş atlama
  yöne bağlı (basma→odak ≤300 ms, odak→basma ≤900 ms; basma→basma hiç). Odak yolunda iş `next(e)`'den sonra ve
  yeniden çizim 400 ms gecikmeli (hemen invalidate odak çizimiyle birleşip kayboluyor). Düğme işi o anki state'ten
  karar verir (çizimdeki kapanıştan değil). Tıklama sorunlarında `$.store`'a sessiz kayıt + dosyadan okuma işe yaradı.
- Yeni panel düğmesini `paneButton` ile ekle (işi `paneActions`'a kaydeder; odak yolu da çalıştırır).
- Masaüstünde Client içindeki Button yerel çizilmez (düz yazı); panel ağacındaki Button yerel düğme olur.
- Masaüstünde çerçeveli Box üç satır boyunda çizilir (üst çizgi, yazı, alt çizgi): küçük düğme için çerçeve değil zemin rengi.
- Masaüstünde Button `plain`/`variant` ne olursa olsun aynı çizilir, boyu yazısından gelir: tıklanacak düğmeye
  simge değil kelime ver.
- API kuralları (öğrenildi): `$` başka dosyaya geçirilemez (yalnız aynı dosyadaki fonksiyonlara); bir olaya
  matcher'sız ikinci hook bağlanamaz; çizimde okunan her state yazımı o çizimi baştan çizer (SVG yeniden yüklenir).
- Sık değişen yazı Client bölgesinde (`hooks/live.tsx`: Claude ve bant; `hooks/card.tsx`: kartın başlığı + canlı
  satırları ('head') ve açık sekmenin metni ('body'), `ui.message` ile saniyede bir sorar, ajan bitince durur). Maskotlar resim modunda (`IS_FRAMED = false`), animasyon oynuyor.
- Ölçüm (masaüstü): alt ajan adımları sohbette çizilmez; ToolGroup başlığını uygulama çizer; `onScreen` yok.
- Bağlam sayısı doğrulandı: kart = Claude Code'un alt ajan raporu (47.7k ↔ 47.676, 41.4k ↔ 41.374).

## Toplanan fikirler (öneri, 2026-10-10)
- v0.5: çalışan adımda simge döner, bitince süre; hata satırı gizlenmez (claude-skins).
- v0.6: mini maskot işe göre poz alır + kısa yazı ("Düzenliyor · register.tsx"); bant ilk ajanla belirir,
  işler bitince kaybolur; sığmayan ajanlar "+N" rozeti olur, rozet paneli açar (clawd-spinner, savvy-progress, görüş).
- Ajan bitince tek seferlik kutlama karesi (clawd-spinner).
- Ayar: tek komutla kapatma ve sakin mod, oturumlar arası hatırlansın; `prefers-reduced-motion` (claude-skins, savvy-progress).

## v0.7 ve sakin mod için notlar (2026-10-10)
- Panel içi sekme: hazır eleman yok; buton satırı + seçili sekmenin içeriği (resmi örnek "Build a pane with tabs").
  Tıklanabilir kart/açılır bölüm için de Button + state deseni. Prompt'a metin: `$.prompt.fill` (taslak) /
  `$.prompt.submit`. Kaynak: https://code.claude.com/docs/en/plugins/mods/interface
- Sakin mod: `<img>` içindeki SVG'de SMIL'i CSS durduramaz; ayar açıkken `<animate>` içermeyen statik SVG üret
  (görüş). macOS "Hareketi azalt" Chromium'a yansır (animation_mac.mm). WCAG 2.2.2: 5 sn'den uzun otomatik
  hareket için durdurma yolu gerekir. https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html

## Esin kaynakları
- awesome-claude-code-mods kataloğu: https://github.com/karanb192/awesome-claude-code-mods
- savvy-progress (alt ajan paneli + bant), claude-skins (araç satırı temaları), claude-work-visualized (dosya paneli).
- NN/g animasyon bulguları: https://www.nngroup.com/articles/animation-usability/

## Bilinen sınırlar
- Mod sol menüye, üst çubuğa, izin sorularına ve uygulamanın kendi panellerine (Arka plan görevleri) dokunamaz.
- Çalışma satırı maskotu ve adım simgeleri yalnız masaüstünde (Svg); terminal yazıyla kalır.
- Ölçüm (2026-10-10, masaüstü): alt ajanın adımları ana sohbette satır olarak çizilmez; okumalar katlanmış
  ToolGroup olarak gelir (isExpanded false); `onScreen` gönderilmez, satır başına 1-3 çizim.
- Masaüstü ToolGroup başlığını kendisi çizer; hook'un ağacı başlığın altına düşer (v0.6.2'de gruba dokunulmuyor).
- Sonradan katılan ajanlarda (pano yüklenmeden başlamış) model ve başlangıç anı bilinmez.

Son güncelleme: 2026-10-10 (oturum sonu, v0.9.52)
