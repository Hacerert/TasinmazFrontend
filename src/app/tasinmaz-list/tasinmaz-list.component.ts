import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { TasinmazListDto, TasinmazService } from '../services/tasinmaz.service';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';
// OpenLayers imports
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Feature from 'ol/Feature';
import { Polygon } from 'ol/geom';
import { transform } from 'ol/proj';
import { Style, Stroke, Fill } from 'ol/style';

@Component({
  selector: 'app-tasinmaz-list',
  templateUrl: './tasinmaz-list.component.html',
  styleUrls: ['./tasinmaz-list.component.css']
})
export class TasinmazListComponent implements OnInit, AfterViewInit {

  tasinmazlar: TasinmazListDto[] = [];
  filteredTasinmazlar: TasinmazListDto[] = [];
  loading: boolean = true;
  error: string | null = null;
  selectedTasinmazIds: number[] = [];
  showModal: boolean = false;
  modalMessage: string = '';
  modalCallback: Function | null = null;

  // Kullanıcı rolü kontrolü
  isAdmin: boolean = false;
  userRole: string = '';

  // Filtreleme değişkenleri
  filterSehir: string = '';
  filterIlce: string = '';
  filterMahalle: string = '';
  filterTasinmazTuru: string = '';
  filterParselNumarasi: string = '';
  filterPaftaNumarasi: string = '';
  filterAdres: string = '';
  filterKoordinat: string = '';
  filterAda: string = '';

  // Dinamik filtre seçenekleri
  availableSehirler: string[] = [];
  availableIlceler: string[] = [];
  availableMahalleler: string[] = [];
  availableTurler: string[] = [];

  // Sayfalama değişkenleri
  currentPage: number = 1;
  itemsPerPage: number = 5; // Her sayfada 5 kayıt
  
  // Math referansı template'de kullanmak için
  Math = Math;

  // Map state
  listMap!: Map;
  listVectorSource!: VectorSource;
  listVectorLayer!: VectorLayer<VectorSource>;
  mapInitialized: boolean = false;

  constructor(
    private tasinmazService: TasinmazService,
    private router: Router,
    private authService: AuthService,
    private datePipe: DatePipe
  ) { }

  ngOnInit(): void {
    this.checkUserRole();
    this.getTasinmazlar();
  }

  ngAfterViewInit(): void {
    // map container render after view init
    setTimeout(() => this.initMap(), 0);
  }

  /**
   * Kullanıcı rolünü kontrol eder
   */
  checkUserRole(): void {
    this.userRole = this.authService.getUserRole() || '';
    this.isAdmin = this.userRole === 'Admin';
    console.log('👤 Kullanıcı rolü:', this.userRole, 'Admin mi:', this.isAdmin);
  }

  /**
   * Veritabanından tüm taşınmazları çeker.
   */
  getTasinmazlar(): void {
    this.loading = true;
    this.tasinmazService.getTasinmazlar().subscribe({
      next: (data) => {
        this.tasinmazlar = data;
        this.filteredTasinmazlar = [...data]; // Filtrelenmiş listeyi başlat
        this.populateFilterOptions(); // Filtre seçeneklerini oluştur
        this.loading = false;
        this.error = null;
        this.updateMapFeatures();
      },
      error: (e) => {
        this.error = 'Taşınmazlar yüklenirken bir hata oluştu.';
        this.loading = false;
        console.error(e);
      }
    });
  }

  /**
   * Mevcut taşınmaz verilerine göre filtre seçeneklerini oluştur
   */
  populateFilterOptions(): void {
    // Benzersiz şehirleri çıkar (adres alanından)
    const sehirler = new Set<string>();
    const ilceler = new Set<string>();
    const mahalleler = new Set<string>();
    const turler = new Set<string>();

    this.tasinmazlar.forEach(tasinmaz => {
      // Adres alanından şehir, ilçe, mahalle bilgisi çıkarmaya çalış
      if (tasinmaz.adres) {
        const adresParts = tasinmaz.adres.split(' ');
        // Basit bir yaklaşım - gerçek veride nasıl formatlandığına göre ayarlanabilir
        if (adresParts.length > 0) {
          sehirler.add(adresParts[0]);
        }
        if (adresParts.length > 1) {
          ilceler.add(adresParts[1]);
        }
        if (adresParts.length > 2) {
          mahalleler.add(adresParts[2]);
        }
      }

      // Ada veya parsel bilgisinden tür bilgisi çıkar
      if (tasinmaz.ada) {
        turler.add(`Tip-${tasinmaz.ada}`);
      }
    });

    // Eğer yeterli veri yoksa, varsayılan değerler ekle
    if (sehirler.size === 0) {
      this.availableSehirler = ['İstanbul', 'Ankara', 'İzmir'];
    } else {
      this.availableSehirler = Array.from(sehirler).sort();
    }

    if (ilceler.size === 0) {
      this.availableIlceler = ['Beşiktaş', 'Kadıköy', 'Keçiören'];
    } else {
      this.availableIlceler = Array.from(ilceler).sort();
    }

    if (mahalleler.size === 0) {
      this.availableMahalleler = ['Levent', 'Etlik', 'Fenerbahçe'];
    } else {
      this.availableMahalleler = Array.from(mahalleler).sort();
    }

    if (turler.size === 0) {
      this.availableTurler = ['deneme', 'deneme2', 'deneme3'];
    } else {
      this.availableTurler = Array.from(turler).sort();
    }

    console.log('Filtre seçenekleri oluşturuldu:', {
      sehirler: this.availableSehirler,
      ilceler: this.availableIlceler,
      mahalleler: this.availableMahalleler,
      turler: this.availableTurler
    });
  }

  /**
   * Filtreleri uygula
   */
  applyFilters(): void {
    let filtered = [...this.tasinmazlar];

    if (this.filterSehir) {
      filtered = filtered.filter(t => 
        t.adres && t.adres.toLowerCase().includes(this.filterSehir.toLowerCase())
      );
    }

    if (this.filterIlce) {
      filtered = filtered.filter(t => 
        t.adres && t.adres.toLowerCase().includes(this.filterIlce.toLowerCase())
      );
    }

    if (this.filterMahalle) {
      filtered = filtered.filter(t => 
        t.adres && t.adres.toLowerCase().includes(this.filterMahalle.toLowerCase())
      );
    }

    if (this.filterParselNumarasi) {
      filtered = filtered.filter(t => 
        t.parsel && t.parsel.toString().includes(this.filterParselNumarasi)
      );
    }

    if (this.filterPaftaNumarasi) {
      filtered = filtered.filter(t => 
        t.ada && t.ada.toString().includes(this.filterPaftaNumarasi)
      );
    }

    if (this.filterAdres) {
      filtered = filtered.filter(t => 
        t.adres && t.adres.toLowerCase().includes(this.filterAdres.toLowerCase())
      );
    }

    if (this.filterKoordinat) {
      filtered = filtered.filter(t => 
        t.koordinat && t.koordinat.toLowerCase().includes(this.filterKoordinat.toLowerCase())
      );
    }

    this.filteredTasinmazlar = filtered;
    this.currentPage = 1; // Filtreler uygulandığında sayfayı sıfırla
    this.updateMapFeatures();
  }

  /**
   * Filtreleri temizle
   */
  clearFilters(): void {
    this.filterSehir = '';
    this.filterIlce = '';
    this.filterMahalle = '';
    this.filterTasinmazTuru = '';
    this.filterParselNumarasi = '';
    this.filterPaftaNumarasi = '';
    this.filterAdres = '';
    this.filterKoordinat = '';
    this.filterAda = '';
    this.filteredTasinmazlar = [...this.tasinmazlar];
    this.currentPage = 1; // Filtreleri temizledikten sonra sayfayı sıfırla
    this.updateMapFeatures();
  }

  // Sayfalama için getter'lar ve metodlar
  get totalPages(): number {
    return Math.ceil(this.filteredTasinmazlar.length / this.itemsPerPage);
  }

  // ===== Map helpers =====
  private initMap(): void {
    const mapElement = document.getElementById('listMap');
    if (!mapElement || this.mapInitialized) {
      return;
    }

    try {
      this.listVectorSource = new VectorSource();
      this.listVectorLayer = new VectorLayer({
        source: this.listVectorSource,
        style: new Style({
          stroke: new Stroke({ color: '#3b82f6', width: 2 }),
          fill: new Fill({ color: 'rgba(59,130,246,0.15)' })
        })
      });

      this.listMap = new Map({
        target: 'listMap',
        layers: [
          new TileLayer({ source: new OSM() }),
          this.listVectorLayer
        ],
        view: new View({
          center: transform([35.0, 39.0], 'EPSG:4326', 'EPSG:3857'),
          zoom: 5
        })
      });

      this.mapInitialized = true;
      this.updateMapFeatures();
    } catch (e) {
      console.error('Liste haritası initialize edilemedi:', e);
    }
  }

  private updateMapFeatures(): void {
    if (!this.mapInitialized || !this.listVectorSource) return;
    this.listVectorSource.clear();

    const features: Feature[] = [];
    for (const t of this.filteredTasinmazlar) {
      if (!t.koordinat) continue;
      const polygon = this.parsePolygonFromCoordString(t.koordinat);
      if (polygon) {
        features.push(new Feature(polygon));
      }
    }

    if (features.length > 0) {
      this.listVectorSource.addFeatures(features);
      // fit view to features
      const extent = this.listVectorSource.getExtent();
      try {
        this.listMap.getView().fit(extent, { padding: [30, 30, 30, 30], maxZoom: 15, duration: 300 });
      } catch {}
    } else {
      // fallback center on TR
      this.listMap.getView().setCenter(transform([35.0, 39.0], 'EPSG:4326', 'EPSG:3857'));
      this.listMap.getView().setZoom(5);
    }
  }

  private parsePolygonFromCoordString(coordString: string): Polygon | null {
    try {
      const pairs = coordString.split(';').map(p => p.trim()).filter(Boolean);
      if (pairs.length < 3) return null;
      const coords = pairs.map(pair => {
        const [latStr, lngStr] = pair.split(',');
        const lat = Number(latStr);
        const lng = Number(lngStr);
        return [lng, lat] as [number, number];
      });
      if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
        coords.push(coords[0]);
      }
      const webMercator = coords.map(c => transform(c, 'EPSG:4326', 'EPSG:3857')) as [number, number][];
      return new Polygon([webMercator]);
    } catch (e) {
      console.warn('Koordinat parse hatası:', e);
      return null;
    }
  }

  get paginatedTasinmazlar(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredTasinmazlar.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPagesArray(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  /**
   * Yeni bir taşınmaz ekleme sayfasına yönlendirir.
   */
  addTasinmaz(): void {
    this.router.navigate(['/tasinmaz-add']);
  }

  /**
   * Seçilen taşınmazları silmek için onay modalını açar.
   */
  deleteSelectedTasinmazlar(): void {
    if (this.selectedTasinmazIds.length === 0) {
      return;
    }
    this.openModal(
      'Seçilen ' + this.selectedTasinmazIds.length + ' adet taşınmazı silmek istediğinizden emin misiniz?',
      () => this.onConfirmDeleteSelected()
    );
  }

  /**
   * Seçilen taşınmazları silme işlemini gerçekleştirir.
   */
  async onConfirmDeleteSelected(): Promise<void> {
    try {
      const deletePromises = this.selectedTasinmazIds.map(id => 
        firstValueFrom(this.tasinmazService.deleteTasinmaz(id))
      );

      await Promise.all(deletePromises);
      
      console.log('Tüm seçilen taşınmazlar başarıyla silindi.');
      this.getTasinmazlar(); // Listeyi yenile
      this.selectedTasinmazIds = [];
      this.closeModal();
    } catch (error) {
      this.error = 'Taşınmazlar silinirken bir hata oluştu.';
      console.error('Silme hatası:', error);
      this.selectedTasinmazIds = [];
      this.closeModal();
    }
  }



  /**
   * Taşınmaz düzenleme sayfasına yönlendirir.
   */
  editTasinmaz(id: number): void {
    this.router.navigate(['/tasinmaz-edit', id]);
  }



  /**
   * Checkbox seçimi değiştiğinde çalışır.
   */
  onCheckboxChange(id: number, event: any): void {
    if (event.target.checked) {
      this.selectedTasinmazIds.push(id);
    } else {
      this.selectedTasinmazIds = this.selectedTasinmazIds.filter(tasinmazId => tasinmazId !== id);
    }
  }

  /**
   * Hepsini seç/seçimi kaldır checkbox'ı için.
   */
  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.selectedTasinmazIds = this.tasinmazlar.map(tasinmaz => tasinmaz.id!);
    } else {
      this.selectedTasinmazIds = [];
    }
  }

  /**
   * Kullanıcı çıkış işlemini yapar.
   */
  logout(): void {
    console.log('🚪 TasinmazList - Logout butonuna tıklandı');
    this.authService.logout();
    console.log('🔄 TasinmazList - Login sayfasına yönlendiriliyor...');
    
    // Router navigation dene, başarısız olursa window.location kullan
    this.router.navigate(['/login']).then(() => {
      console.log('✅ TasinmazList - Login sayfasına başarıyla yönlendirildi');
    }).catch((error) => {
      console.error('❌ TasinmazList - Router navigation hatası:', error);
      console.log('🔄 TasinmazList - Window.location ile yönlendiriliyor...');
      window.location.href = '/login';
    });
  }

  /**
   * Modal pop-up açar.
   */
  openModal(message: string, callback: Function): void {
    this.modalMessage = message;
    this.modalCallback = callback;
    this.showModal = true;
  }

  /**
   * Modal pop-up'ı kapatır.
   */
  closeModal(): void {
    this.showModal = false;
    this.modalMessage = '';
    this.modalCallback = null;
  }

  /**
   * Modal'daki Tamam butonuna basıldığında callback'i çalıştırır.
   */
  confirmAction(): void {
    if (this.modalCallback) {
      this.modalCallback();
    }
  }

  /**
   * Taşınmaz listesini Excel dosyasına aktarır.
   */
  exportToExcel(exportAll: boolean = true): void {
    console.log('📊 Taşınmaz Excel export başlatılıyor...', exportAll ? 'Tümü' : 'Seçililer');

    let dataToExport: TasinmazListDto[] = [];

    if (exportAll) {
      if (this.filteredTasinmazlar.length === 0) {
        console.warn('Aktarılacak taşınmaz kaydı bulunmamaktadır.');
        return;
      }
      dataToExport = this.filteredTasinmazlar;
    } else {
      if (this.selectedTasinmazIds.length === 0) {
        console.warn('Aktarılacak seçili taşınmaz kaydı bulunmamaktadır.');
        return;
      }
      dataToExport = this.filteredTasinmazlar.filter(tasinmaz => this.selectedTasinmazIds.includes(tasinmaz.id!));
    }

    const data = dataToExport.map((tasinmaz, index) => ({
      'Sıra No': index + 1,
      'ID': tasinmaz.id,
      'Ada': tasinmaz.ada,
      'Parsel': tasinmaz.parsel,
      'Adres': tasinmaz.adres,
      'Koordinat': tasinmaz.koordinat,
      'Taşınmaz Tipi': tasinmaz.tasinmazTipi || '-',
      'Mahalle ID': tasinmaz.mahalleId
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    // Sütun genişliklerini ayarla
    const columnWidths = [
      { wch: 8 },   // Sıra No
      { wch: 8 },   // ID
      { wch: 12 },  // Ada
      { wch: 12 },  // Parsel
      { wch: 40 },  // Adres
      { wch: 25 },  // Koordinat
      { wch: 15 },  // Taşınmaz Tipi
      { wch: 12 }   // Mahalle ID
    ];
    ws['!cols'] = columnWidths;

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Taşınmazlar');

    const simdi = new Date();
    const tarih = this.datePipe.transform(simdi, 'dd-MM-yyyy');
    const saat = this.datePipe.transform(simdi, 'HH-mm-ss');
    const exportType = exportAll ? 'Tumunu' : 'Secili';
    const dosyaAdi = `Tasinmazlar_${exportType}_${tarih}_${saat}.xlsx`;

    XLSX.writeFile(wb, dosyaAdi);

    console.log(`✅ Excel dosyası indirildi: ${dosyaAdi}`);
  }

  exportSelectedToExcel(): void {
    this.exportToExcel(false);
  }

  // Navigasyon metodları
  goBackToAdmin(): void {
    console.log('🔄 Admin sayfasına yönlendirme başlatılıyor...');
    
    // Debug bilgileri
    console.log('👤 Mevcut kullanıcı giriş durumu:', this.authService.isLoggedIn());
    console.log('🏷️ Kullanıcı rolü:', this.authService.getUserRole());
    console.log('🗺️ Mevcut URL:', window.location.pathname);
    console.log('🎯 Hedef URL: /admin-dashboard');
    
    // Önce Angular Router ile dene
    this.router.navigate(['/admin-dashboard'])
      .then((success) => {
        if (success) {
          console.log('✅ Router ile admin sayfasına başarıyla yönlendirildi');
        } else {
          console.log('⚠️ Router başarısız, window.location ile deneniyor...');
          // Router başarısız olursa window.location kullan
          window.location.href = '/admin-dashboard';
        }
      })
      .catch((error) => {
        console.error('❌ Router hatası:', error);
        console.log('🔄 Fallback: window.location kullanılıyor...');
        // Hata durumunda window.location kullan
        window.location.href = '/admin-dashboard';
      });
  }
}
