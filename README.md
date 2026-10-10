# Ajan panosu

Claude Code'un yan paneline Claude'u ve alt ajanlarını canlı gösteren bir eklenti. Her ajan tipi kendi renginde ve
aksesuarıyla bir piksel maskottur; çalışırken hareket eder, bitince onay, hata ya da durdurma işareti alır.
Sohbetteki adım satırları da küçük simgeler kazanır. Sürüm: 0.9.52.

## Ne yapar
- **Panel:** üstte Claude'un kartı (şu an ne yapıyor, arka planda kaç ajan çalıştığı, son turun özeti), altında
  alt ajan kartları (en yeni üstte). Kart rengi duruma göre değişir: çalışıyor, bitti, hata, durduruldu.
  Bağlam boyutu tek yerde, "Son tur" satırında; sıkıştırılınca bir sonraki tur bitene kadar "sıkıştırıldı 180k → 40k".
- **Kartta canlı satırlar:** model, geçen süre, araç sayısı, bağlam boyutu, arka plan ajanıysa "arka plan".
  Masaüstünde ayrıca şu anki adım: araç sürerken "↳ Bash · npm test · 34sn", araç bitince "↳ düşünüyor · 12sn"
  (bantta kısa hâli; aynı adım 60 sn'yi geçince uyarı renginde); bu satırlar saniyede bir yenilenir ve panel yalnız ajan başlarken/biterken,
  tur başında/sonunda ve kart açılıp kapanırken yeniden çizilir. Terminalde satırlar her araç çağrısında yenilenir.
- **Maskotlar:** her tipin rengi ve aksesuarı var. Alt ajan pozları: çalışıyor, bitti, hata, durduruldu.
  Claude'a özgü pozlar: düşünüyor, araç kullanıyor, boşta, alt ajanı bekliyor (kartlara bakıp sana döner, o yana eğilir, ayağıyla tempo tutar: turu bitmişken arka planda
  ajan çalışıyorsa; o bitince Claude devam eder, bu arada sen de yazabilirsin). Tanınmayan tip gri maskot ve kendi adıyla gösterilir.
- **Çalışma satırı:** masaüstünde turun "Working" satırının önünde Claude'un mini maskotu.
- **Sohbette adım simgeleri (masaüstü):** tek tek çizilen araç adımlarının önünde türüne göre simge (kabuk, düzenleme, okuma, web, ajan,
  diğer). Çalışan adımda simge hareket eder; biten durur, hatalı olan soluklaşıp kırmızı nokta alır, kesilen soluklaşır.
  Katlanmış gruplar ("Okuma 3 dosya") ile soru ve plan modu diyaloglarına simge eklenmez.
- **"Ajan" satırı (masaüstü):** önünde alt ajanın kendi tipinin mini maskotu; arka plan ajanında da ajan
  bitene kadar çalışıyor pozunda kalır, tiki bitince alır.
- **Tur sonu özeti:** tur bitince süre, araç sayısı, başlatılan alt ajanlar, düzenlenen dosyalar ve bağlam
  boyutu. Panelde Claude'un altında "Son tur" olarak kalır; masaüstünde ajan bandı yokken prompt üstü bantta da
  görünür, ✕ ya da yeni turla gizlenir (terminal tur süresini kendi satırında yazar).
- **Prompt üstü bant:** her an tek konu gösterir. Alt ajan çalışırken masaüstünde her ajan kendi satırında: mini
  maskot ve ne yaptığı canlı (terminalde ad listesi). Dörtten fazlası "+N" olur. Hepsi bitince "✓ n ajan bitti" (sorun varsa "· k sorunlu")
  yazar, 8 saniye sonra ya da ✕ ile kaybolur. Sağdaki ☰ paneli açar.
- **Açılır kart (masaüstü):** başlığın sağındaki sabit simgeler: ▸ son 8 adımı (çalışırken canlı) ve raporun
  ilk satırlarını açar; ajan bitince ↵ raporu mesaj kutusuna taslak olarak ekler, ⧉ panoya kopyalar. Aç/kapa ve
  düğmeler kartın kendi bölgesinde çalışır; panel ve maskotlar yeniden çizilmez.
- **Terminal:** resim yok; kartlar yazı yüzleriyle çizilir, örn. `(•ᴗ•)`.
- Uygulama yeniden başlayınca aynı sohbetin kartları ve "Son tur" satırı geri gelir (son 10 sohbet saklanır); o sırada
  çalışan kart "durduruldu" görünür, ajan hâlâ çalışıyorsa yeniden "çalışıyor" olur. `/clear` panoyu boşaltır.
- Panel ayrıca açılışta zaten çalışan ajanları kart olarak devralır. 12 kartı aşınca önce en eski biten kart atılır;
  çalışan kartlar atılmaz.

### Ajan tipleri

| Tip | Ad | Aksesuar |
| --- | --- | --- |
| `main` | Claude | yok |
| `okuyucu` | Okuyucu | gözlük |
| `sentezci` | Sentezci | tüy kalem |
| `denetleyici` | Denetleyici | büyüteç |
| `web-researcher` | Web araştırmacısı | anten |
| `explore` | Kâşif | kafa lambası |
| `plan` | Planlayıcı | beyaz tahta |
| `general-purpose` | Genel amaçlı | baret ve İngiliz anahtarı (camgöbeği) |
| `claude` | Claude | kıvılcım |
| `fork` | Çatal | kıvılcım |
| `claude-code-guide` | Rehber | harita |

`eklenti:tip` biçimindeki adlarda yalnız son parça aranır.

## Gereksinim
- Claude Code 2.1.287 veya üstü.
- Terminal ya da masaüstü uygulamasının Code sekmesi. VS Code ve bulut oturumlarında çizilmez.

## Kurulum
GitHub'dan (Claude Code 2.1.290 ve üstü, mod desteği olan sürüm):

```
claude plugin marketplace add hburakalemdar/ajan-panosu
claude plugin install ajan-panosu@burak-mods
```

Yerel klasörden denemek için:

```
claude plugin marketplace add ./<klasör>   # göreli yol ./ ile başlamalı
claude plugin install ajan-panosu@burak-mods
```

Kurulum o anki kopyayı alır; kaynak değişince kendiliğinden güncellenmez. Yeni sürümden sonra:

```
claude plugin marketplace update burak-mods
claude plugin update ajan-panosu@burak-mods   # sonra uygulamayı yeniden başlat
```

## Kullanım
- Panel oturum açılınca kendiliğinden açılır. Kapattıysan geri açmak için:

```
/pano
```

- Ses ve kutlama varsayılan kapalı; her komut o ayarı açıp kapatır, seçim oturumlar arasında kalır:
  - `/pano ses`: bir ajan dalgası bitince kısa çan (sorun varsa alçalan ton). macOS'ta çalar.
  - `/pano kutlama`: dalga sorunsuz bitince bantta bir kez konfeti (masaüstü).
- Biten, hata alan ya da durdurulan kartları kaldırmak için panelde **Bitenleri temizle** düğmesi
  (çalışan kartlara dokunmaz).
- Kapatmak için `/plugin` → Installed bölümünden eklentiyi kapat.

## Bilinen sınırlar
- Mod sol menüye, üst çubuğa, izin sorularına ve uygulamanın kendi panellerine (Arka plan görevleri) dokunamaz.
- Alt ajanın adımları ana sohbette satır olarak çizilmez (masaüstünde ölçüldü, 2026-10-10); okumalar katlanmış
  grup olarak gelir. Bu yüzden alt ajanın rengi sohbette yalnız "Ajan" satırında görünür.
- Eklenti yüklenmeden başlamış ajanlarda başlangıç anı bilinmez (süre "≥" ile gösterilir); model ajan bitene kadar
  bilinmez, ön/arka plan bilgisi hiç bilinmez.
- Çalışma satırı maskotu ve sohbetteki adım simgeleri yalnız masaüstünde çizilir (resim gerektirir).

## Yol haritası
Ayrıntı: `PLAN.md`. Her adım ayrı sürümdür; beğenilmezse geri alınır.

- [x] v0.4 Spinner maskotu: "Working" satırında mini maskot
- [x] v0.5 Araç satırları: adım simgeleri ve "Ajan" satırında mini maskot
- [x] v0.6 Prompt üstü bant: çalışan ajanların mini maskotları, "Panel" düğmesi, hepsi bitince "✓ n ajan bitti"
- [x] v0.7 Tıklanabilir kartlar; v0.9.32'den beri sekmeli: Prompt · Adımlar · Rapor (tam metin), "Detay ▼", "Prompt'a al", "Kopyala"
- [x] v0.8 Tur sonu özeti: süre, araç, düzenlenen dosyalar, bağlam
- [x] v0.9 Ses ve kutlama: `/pano ses`, `/pano kutlama` (varsayılan kapalı)
- [-] v1.0 Temalar: elendi (renk, ajan tipi eşleşmesini bozar; bilgi taşımaz)

İlke: ses ve kutlama varsayılan kapalı. Hareketi azaltma seçeneği (`/pano sakin`) yapılmayacak.

## Lisans
MIT, bkz. `LICENSE`.
