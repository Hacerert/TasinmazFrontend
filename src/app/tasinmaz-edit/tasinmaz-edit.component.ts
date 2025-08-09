import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TasinmazService, TasinmazListDto, TasinmazUpdateRequest } from '../services/tasinmaz.service';
import { LocationService } from '../services/location.service';

// OpenLayers imports
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import { transform } from 'ol/proj';
import { Polygon } from 'ol/geom';
import Feature from 'ol/Feature';
import { Style, Stroke, Fill } from 'ol/style';
import { getArea } from 'ol/sphere';

@Component({
  selector: 'app-tasinmaz-edit',
  templateUrl: './tasinmaz-edit.component.html',
  styleUrls: ['./tasinmaz-edit.component.css']
})
export class TasinmazEditComponent implements OnInit, AfterViewInit, OnDestroy {
  tasinmazForm!: FormGroup;
  tasinmazId: number | null = null;
  iller: any[] = [];
  ilceler: any[] = [];
  mahalleler: any[] = [];
  tasinmazTipleri: string[] = ['Arsa', 'Arazi', 'Bina', 'Konut', 'Daire'];
  loading: boolean = false;
  error: string | null = null;
  successMessage: string | null = null;

  // OpenLayers harita özellikleri
  map!: Map;
  vectorSource!: VectorSource;
  vectorLayer!: VectorLayer<VectorSource>;
  drawInteraction!: Draw;
  modifyInteraction!: Modify;
  snapInteraction!: Snap;
  isDrawing: boolean = false;
  hasPolygon: boolean = false;
  polygonArea: number = 0;
  currentPolygon: Feature | null = null;

  // Photo state (local-only preview)
  selectedPhotoFile: File | null = null;
  photoPreview: string | null = null;
  photoError: string | null = null;

  constructor(
    private fb: FormBuilder, 
    private router: Router,
    private route: ActivatedRoute,
    private tasinmazService: TasinmazService,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadIller();
    
    // URL'den ID'yi al
    this.route.params.subscribe(params => {
      this.tasinmazId = +params['id'];
      if (this.tasinmazId) {
        this.loadTasinmaz();
      }
    });
  }

  ngAfterViewInit(): void {
    // Haritayı initialize et
    setTimeout(() => {
      this.initMap();
    }, 1000); // Daha uzun süre bekle
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.setTarget(undefined);
    }
  }

  initForm(): void {
    this.tasinmazForm = this.fb.group({
      il: ['', Validators.required],
      ilce: ['', Validators.required],
      mahalle: ['', Validators.required],
      ada: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      parsel: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      adres: ['', Validators.required],
      koordinat: ['', Validators.required],
      tasinmazTipi: ['', Validators.required],
    });
  }

  loadIller(): void {
    this.locationService.getIller().subscribe({
      next: (data: any) => {
        this.iller = data;
      },
      error: (err: any) => {
        console.error('İller alınırken hata:', err);
        // Test için varsayılan veri
        this.iller = [
          { id: 1, ad: 'İstanbul' },
          { id: 2, ad: 'Ankara' },
          { id: 3, ad: 'İzmir' }
        ];
      }
    });
  }

  loadTasinmaz(): void {
    if (!this.tasinmazId) return;
    
    this.loading = true;
    // Backend'den tam taşınmaz bilgisi çek (nested mahalle, ilce, il bilgileri ile)
    this.tasinmazService.getTasinmazlar().subscribe({
      next: (data: any[]) => {
        console.log('🔍 Taşınmaz düzenleme - Backend\'den gelen data:', data);
        const tasinmaz = data.find(t => t.id === this.tasinmazId);
        console.log('🎯 Bulunan taşınmaz:', tasinmaz);
        
        if (tasinmaz) {
          // Önce temel form değerlerini set et
          this.tasinmazForm.patchValue({
            ada: tasinmaz.ada,
            parsel: tasinmaz.parsel,
            adres: tasinmaz.adres,
            koordinat: tasinmaz.koordinat,
            tasinmazTipi: tasinmaz.tasinmazTipi || ''
          });

          // Eğer nested lokasyon bilgileri varsa kullan
          if (tasinmaz.mahalle && tasinmaz.mahalle.ilce && tasinmaz.mahalle.ilce.il) {
            const ilId = tasinmaz.mahalle.ilce.il.id;
            const ilceId = tasinmaz.mahalle.ilce.id;
            const mahalleId = tasinmaz.mahalle.id;

            console.log('📍 Nested lokasyon bilgileri bulundu:', {
              il: { id: ilId, ad: tasinmaz.mahalle.ilce.il.ad },
              ilce: { id: ilceId, ad: tasinmaz.mahalle.ilce.ad },
              mahalle: { id: mahalleId, ad: tasinmaz.mahalle.ad }
            });

            // İlçeleri yükle
            this.loadIlcelerForEdit(ilId, ilceId, mahalleId, tasinmaz);
          } else {
            // Nested veri yoksa sadece mahalle ID'sini kullan
            console.log('⚠️ Nested lokasyon bilgileri yok, sadece mahalle ID kullanılıyor:', tasinmaz.mahalleId);
            this.loadLocationByMahalleId(tasinmaz.mahalleId, tasinmaz);
          }
        } else {
          console.error('❌ Taşınmaz bulunamadı');
          this.error = 'Taşınmaz bulunamadı!';
          this.loading = false;
        }
      },
      error: (err: any) => {
        this.error = 'Taşınmaz yüklenirken hata oluştu: ' + (err.error?.message || err.message);
        this.loading = false;
        console.error(err);
      }
    });
  }

  private loadIlcelerForEdit(ilId: number, ilceId: number, mahalleId: number, tasinmaz: any): void {
    this.locationService.getIlceler(ilId).subscribe({
      next: (ilceler: any) => {
        this.ilceler = ilceler;
        
        // Mahalleleri yükle
        this.loadMahallelerForEdit(ilceId, mahalleId, tasinmaz, ilId);
      },
      error: (err: any) => {
        console.error('İlçeler alınırken hata:', err);
        this.loadMahallelerForEdit(ilceId, mahalleId, tasinmaz, ilId);
      }
    });
  }

  private loadMahallelerForEdit(ilceId: number, mahalleId: number, tasinmaz: any, ilId: number): void {
    this.locationService.getMahalleler(ilceId).subscribe({
      next: (mahalleler: any) => {
        this.mahalleler = mahalleler;
        
        // Tüm dropdown'lar hazır olduğunda form değerlerini set et
        console.log('📝 Form değerleri set ediliyor:', {
          il: ilId,
          ilce: ilceId,
          mahalle: mahalleId,
          ada: tasinmaz.ada,
          parsel: tasinmaz.parsel,
          adres: tasinmaz.adres,
          koordinat: tasinmaz.koordinat,
          tasinmazTipi: tasinmaz.tasinmazTipi || ''
        });

        this.tasinmazForm.patchValue({
          il: ilId,
          ilce: ilceId,
          mahalle: mahalleId,
          ada: tasinmaz.ada,
          parsel: tasinmaz.parsel,
          adres: tasinmaz.adres,
          koordinat: tasinmaz.koordinat,
          tasinmazTipi: tasinmaz.tasinmazTipi || ''
        });
        
        console.log('✅ Form değerleri set edildi, current form value:', this.tasinmazForm.value);
        this.loading = false;
        
        // Mevcut koordinatları haritada göster
        if (tasinmaz.koordinat) {
          setTimeout(() => {
            this.loadExistingPolygon(tasinmaz.koordinat);
          }, 500);
        }
      },
      error: (err: any) => {
        console.error('Mahalleler alınırken hata:', err);
        
        // Hata olsa bile mevcut bilgileri doldur
        this.tasinmazForm.patchValue({
          il: ilId,
          ilce: ilceId,
          mahalle: mahalleId,
          ada: tasinmaz.ada,
          parsel: tasinmaz.parsel,
          adres: tasinmaz.adres,
          koordinat: tasinmaz.koordinat,
          tasinmazTipi: tasinmaz.tasinmazTipi || ''
        });
        
        this.loading = false;
        
        // Mevcut koordinatları haritada göster
        if (tasinmaz.koordinat) {
          setTimeout(() => {
            this.loadExistingPolygon(tasinmaz.koordinat);
          }, 500);
        }
      }
    });
  }

  /**
   * Mahalle ID'sinden geriye doğru çalışarak il, ilçe, mahalle bilgilerini bulur
   */
  private loadLocationByMahalleId(mahalleId: number, tasinmaz: any): void {
    console.log('🔍 Mahalle ID\'sinden lokasyon bilgileri aranıyor:', mahalleId);
    
    // Backend'den nested verilerle tüm mahalleri al
    this.locationService.getAllMahalleler().subscribe({
      next: (allMahalleler: any[]) => {
        console.log('📍 Backend\'den gelen mahalleler (nested):', allMahalleler);
        const mahalle = allMahalleler.find(m => m.id === mahalleId);
        
        if (mahalle && mahalle.ilce && mahalle.ilce.il) {
          console.log('✅ Nested mahalle bilgisi bulundu:', mahalle);
          
          const ilId = mahalle.ilce.il.id;
          const ilceId = mahalle.ilce.id;
          
          console.log('📍 Çıkarılan lokasyon:', { ilId, ilceId, mahalleId });
          
          // Dropdown'ları doldur
          this.loadDropdownsAndSetValues(ilId, ilceId, mahalleId, tasinmaz);
        } else {
          console.error('❌ Mahalle bulunamadı veya nested veri eksik:', mahalle);
          this.setFormWithoutLocation(tasinmaz, mahalleId);
        }
      },
      error: (err) => {
        console.error('❌ Mahalle servisi hatası:', err);
        this.setFormWithoutLocation(tasinmaz, mahalleId);
      }
    });
  }

  private loadDropdownsAndSetValues(ilId: number, ilceId: number, mahalleId: number, tasinmaz: any): void {
    // İlçeleri yükle
    this.locationService.getIlceler(ilId).subscribe({
      next: (ilceler: any) => {
        this.ilceler = ilceler;
        
        // Mahalleleri yükle
        this.locationService.getMahalleler(ilceId).subscribe({
          next: (mahalleler: any) => {
            this.mahalleler = mahalleler;
            
            // Form değerlerini set et
            this.tasinmazForm.patchValue({
              il: ilId,
              ilce: ilceId,
              mahalle: mahalleId
            });
            
            console.log('✅ Tüm lokasyon bilgileri yüklendi ve form set edildi');
            this.loading = false;
            
            // Mevcut koordinatları haritada göster
            if (tasinmaz.koordinat) {
              setTimeout(() => {
                this.loadExistingPolygon(tasinmaz.koordinat);
              }, 500);
            }
          },
          error: () => this.setFormWithoutLocation(tasinmaz, mahalleId)
        });
      },
      error: () => this.setFormWithoutLocation(tasinmaz, mahalleId)
    });
  }

  private setFormWithoutLocation(tasinmaz: any, mahalleId: number): void {
    console.log('⚠️ Lokasyon bilgileri yüklenemedi, sadece mahalle ID kullanılıyor');
    this.tasinmazForm.patchValue({
      mahalle: mahalleId
    });
    this.loading = false;
    
    // Mevcut koordinatları haritada göster
    if (tasinmaz.koordinat) {
      setTimeout(() => {
        this.loadExistingPolygon(tasinmaz.koordinat);
      }, 500);
    }
  }

  onIlChange(): void {
    const ilId = this.tasinmazForm.get('il')?.value;
    if (ilId) {
      this.locationService.getIlceler(ilId).subscribe({
        next: (data: any) => {
          this.ilceler = data;
          this.mahalleler = [];
          this.tasinmazForm.get('ilce')?.setValue('');
          this.tasinmazForm.get('mahalle')?.setValue('');
        },
        error: (err: any) => {
          console.error('İlçeler alınırken hata:', err);
          // Test için varsayılan veri
          this.ilceler = [
            { id: 1, ad: 'Merkez', ilId: ilId },
            { id: 2, ad: 'Batı', ilId: ilId }
          ];
        }
      });
    } else {
      this.ilceler = [];
      this.mahalleler = [];
    }
  }

  onIlceChange(): void {
    const ilceId = this.tasinmazForm.get('ilce')?.value;
    if (ilceId) {
      this.locationService.getMahalleler(ilceId).subscribe({
        next: (data: any) => {
          this.mahalleler = data;
          this.tasinmazForm.get('mahalle')?.setValue('');
        },
        error: (err: any) => {
          console.error('Mahalleler alınırken hata:', err);
          // Test için varsayılan veri
          this.mahalleler = [
            { id: 1, ad: 'Test Mahalle 1', ilceId: ilceId },
            { id: 2, ad: 'Test Mahalle 2', ilceId: ilceId }
          ];
        }
      });
    } else {
      this.mahalleler = [];
    }
  }

  onSubmit(): void {
    if (this.tasinmazForm.invalid) {
      this.tasinmazForm.markAllAsTouched();
      this.error = 'Lütfen tüm alanları doğru şekilde doldurunuz.';
      return;
    }

    if (!this.tasinmazId) {
      this.error = 'Taşınmaz ID bulunamadı!';
      return;
    }

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    const updateData: TasinmazUpdateRequest = {
      ada: this.tasinmazForm.get('ada')?.value,
      parsel: this.tasinmazForm.get('parsel')?.value,
      adres: this.tasinmazForm.get('adres')?.value,
      koordinat: this.tasinmazForm.get('koordinat')?.value,
      mahalleId: this.tasinmazForm.get('mahalle')?.value
    };

    this.tasinmazService.updateTasinmaz(this.tasinmazId, updateData).subscribe({
      next: (response) => {
        console.log('Taşınmaz başarıyla güncellendi:', response);
        this.loading = false;
        this.successMessage = 'Taşınmaz başarıyla güncellendi!';
        
        // 2 saniye sonra listeye dön
        setTimeout(() => {
          this.router.navigate(['/tasinmaz-list']);
        }, 2000);
      },
      error: (err) => {
        console.error('Taşınmaz güncellenirken hata oluştu:', err);
        this.loading = false;
        this.error = 'Taşınmaz güncellenirken bir hata oluştu: ' + (err.error?.message || err.message);
      }
    });
  }

  // ====== PHOTO HANDLERS ======
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      this.selectedPhotoFile = null;
      this.photoPreview = null;
      return;
    }
    const file = input.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      this.photoError = 'Lütfen JPEG veya PNG formatında bir görsel seçin.';
      this.selectedPhotoFile = null;
      this.photoPreview = null;
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.photoError = 'Dosya boyutu 2 MB üzerinde. Lütfen daha küçük bir dosya seçin.';
      this.selectedPhotoFile = null;
      this.photoPreview = null;
      return;
    }
    this.photoError = null;
    this.selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  goBack(): void {
    this.router.navigate(['/tasinmaz-list']);
  }

  // ====== HARITA METODLARİ ======

  initMap(): void {
    console.log('🗺️ Harita initialize ediliyor...');
    
    // DOM element'in var olduğunu kontrol et
    const mapElement = document.getElementById('editMap');
    if (!mapElement) {
      console.error('❌ editMap elementi bulunamadı!');
      setTimeout(() => {
        this.initMap();
      }, 500);
      return;
    }

    try {
      // Vector source ve layer oluştur
      this.vectorSource = new VectorSource();
      this.vectorLayer = new VectorLayer({
        source: this.vectorSource,
        style: new Style({
          stroke: new Stroke({
            color: '#3b82f6',
            width: 2
          }),
          fill: new Fill({
            color: 'rgba(59, 130, 246, 0.1)'
          })
        })
      });

      // Haritayı oluştur
      this.map = new Map({
        target: 'editMap',
        layers: [
          new TileLayer({
            source: new OSM()
          }),
          this.vectorLayer
        ],
        view: new View({
          center: transform([35.0, 39.0], 'EPSG:4326', 'EPSG:3857'), // Türkiye merkezi
          zoom: 6
        })
      });

      // Modify interaction ekle (mevcut poligonları düzenlemek için)
      this.modifyInteraction = new Modify({ source: this.vectorSource });
      this.map.addInteraction(this.modifyInteraction);

      // Snap interaction ekle
      this.snapInteraction = new Snap({ source: this.vectorSource });
      this.map.addInteraction(this.snapInteraction);

      // Modify olayını dinle
      this.modifyInteraction.on('modifyend', () => {
        this.updatePolygonCoordinates();
      });

      console.log('✅ Harita başarıyla initialize edildi');
    } catch (error) {
      console.error('❌ Harita initialize edilirken hata:', error);
    }
  }

  startDrawing(): void {
    // Önceki çizimi temizle
    this.clearDrawing();

    // Draw interaction oluştur
    this.drawInteraction = new Draw({
      source: this.vectorSource,
      type: 'Polygon',
      style: new Style({
        stroke: new Stroke({
          color: '#ef4444',
          width: 2,
          lineDash: [5, 5]
        }),
        fill: new Fill({
          color: 'rgba(239, 68, 68, 0.1)'
        })
      })
    });

    this.map.addInteraction(this.drawInteraction);
    this.isDrawing = true;

    // Çizim bittiğinde
    this.drawInteraction.on('drawend', (event) => {
      this.currentPolygon = event.feature;
      this.hasPolygon = true;
      this.map.removeInteraction(this.drawInteraction);
      this.isDrawing = false;
      
      // Koordinatları güncelle
      this.updatePolygonCoordinates();
    });
  }

  clearDrawing(): void {
    // Vector source'u temizle
    this.vectorSource.clear();
    this.hasPolygon = false;
    this.polygonArea = 0;
    this.currentPolygon = null;
    
    // Form alanını temizle
    this.tasinmazForm.get('koordinat')?.setValue('');
    
    // Draw interaction'ı kaldır
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.isDrawing = false;
    }
  }

  updatePolygonCoordinates(): void {
    if (this.currentPolygon) {
      const geometry = this.currentPolygon.getGeometry() as Polygon;
      if (geometry) {
        // Get coordinates in EPSG:4326 (WGS84)
        const coordinates = geometry.clone().transform('EPSG:3857', 'EPSG:4326').getCoordinates()[0];
        
        // Format coordinates as string
        const coordString = coordinates.map((coord: number[]) => 
          `${coord[1].toFixed(6)},${coord[0].toFixed(6)}`
        ).join(';');
        
        this.tasinmazForm.get('koordinat')?.setValue(coordString);
        this.calculateArea();
      }
    }
  }

  calculateArea(): void {
    if (this.currentPolygon) {
      const geometry = this.currentPolygon.getGeometry() as Polygon;
      if (geometry) {
        this.polygonArea = getArea(geometry);
      }
    }
  }

  // Mevcut koordinatları haritada göster
  loadExistingPolygon(koordinatString: string): void {
    if (!koordinatString || !this.map) return;

    try {
      // Koordinat string'ini parse et
      const coordPairs = koordinatString.split(';');
      const coordinates = coordPairs.map(pair => {
        const [lat, lng] = pair.split(',').map(Number);
        return [lng, lat]; // OpenLayers [lng, lat] formatı kullanır
      });

      // İlk ve son koordinat aynı değilse, son koordinatı ekle (polygon kapatmak için)
      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push(coordinates[0]);
      }

      // WGS84'ten Web Mercator'a dönüştür
      const transformedCoords = coordinates.map(coord => 
        transform(coord, 'EPSG:4326', 'EPSG:3857')
      );

      // Polygon geometry oluştur
      const polygon = new Polygon([transformedCoords]);
      
      // Feature oluştur
      const feature = new Feature(polygon);
      
      // Vector source'a ekle
      this.vectorSource.addFeature(feature);
      this.currentPolygon = feature;
      this.hasPolygon = true;
      
      // Alanı hesapla
      this.calculateArea();
      
      // Harita görünümünü poligona fit et
      this.map.getView().fit(polygon, { padding: [50, 50, 50, 50] });
      
      console.log('✅ Mevcut poligon haritada gösterildi');
    } catch (error) {
      console.error('❌ Koordinat parse edilemedi:', error);
    }
  }
}
