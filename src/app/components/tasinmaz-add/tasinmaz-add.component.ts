// src/app/components/tasinmaz-add/tasinmaz-add.component.ts
import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { TasinmazService, TasinmazAddRequest } from 'src/app/services/tasinmaz.service';
import { LocationService } from 'src/app/services/location.service';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';

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
  selector: 'app-tasinmaz-add',
  templateUrl: './tasinmaz-add.component.html',
  styleUrls: ['./tasinmaz-add.component.css']
})
export class TasinmazAddComponent implements OnInit, AfterViewInit, OnDestroy {
  tasinmazForm!: FormGroup;
  iller: any[] = [];
  ilceler: any[] = [];
  mahalleler: any[] = [];
  tasinmazTipleri: string[] = ['Arsa', 'Arazi', 'Bina', 'Konut', 'Daire'];
  error: string | null = null;
  loading: boolean = false;

  // OpenLayers properties
  map!: Map;
  vectorSource!: VectorSource;
  vectorLayer!: VectorLayer<VectorSource>;
  drawInteraction!: Draw;
  modifyInteraction!: Modify;
  snapInteraction!: Snap;
  isDrawing: boolean = false;
  hasPolygon: boolean = false;
  polygonArea: string = '';
  currentPolygon: Feature<Polygon> | null = null;

  // Photo (local only)
  selectedPhotoFile: File | null = null;
  photoPreview: string | null = null;
  photoError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private tasinmazService: TasinmazService,
    private locationService: LocationService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadIller();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
    }, 1000);
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
        console.log('İller yüklendi:', data);
      },
      error: (err: any) => {
        console.error('İller alınırken hata:', err);
        this.error = 'İller alınamadı. Backend service kontrol edin.';
        // Test için varsayılan veri
        this.iller = [
          { id: 1, ad: 'İstanbul' },
          { id: 2, ad: 'Ankara' },
          { id: 3, ad: 'İzmir' }
        ];
      }
    });
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

    this.loading = true;
    this.error = null;

    const userId = this.authService.getUserId();
    if (!userId) {
      this.error = 'Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.';
      this.loading = false;
      this.router.navigate(['/login']);
      return;
    }

    const newTasinmaz: TasinmazAddRequest = {
      ilId: this.tasinmazForm.get('il')?.value,
      ilceId: this.tasinmazForm.get('ilce')?.value,
      mahalleId: this.tasinmazForm.get('mahalle')?.value,
      ada: this.tasinmazForm.get('ada')?.value,
      parsel: this.tasinmazForm.get('parsel')?.value,
      adres: this.tasinmazForm.get('adres')?.value,
      koordinat: this.tasinmazForm.get('koordinat')?.value,
      tasinmazTipi: this.tasinmazForm.get('tasinmazTipi')?.value,
      userId: userId
    };

    this.tasinmazService.addTasinmaz(newTasinmaz).subscribe({
      next: (response) => {
        console.log('Taşınmaz başarıyla eklendi:', response);
        alert('Taşınmaz başarıyla eklendi!');
        this.loading = false;
        this.router.navigate(['/tasinmazlarim']);
      },
      error: (err) => {
        console.error('Taşınmaz eklenirken bir hata oluştu:', err);
        this.loading = false;
        this.error = 'Taşınmaz eklenirken bir hata oluştu: ' + (err.error?.message || err.message);
      }
    });
  }

  // OpenLayers Map Functions
  initMap(): void {
    console.log('🗺️ Harita initialize ediliyor...');
    
    // DOM element'in var olduğunu kontrol et
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('❌ map elementi bulunamadı!');
      setTimeout(() => {
        this.initMap();
      }, 500);
      return;
    }

    try {
      // Create vector source for polygons
      this.vectorSource = new VectorSource();

    // Create vector layer with custom style
    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: new Style({
        stroke: new Stroke({
          color: '#3b82f6',
          width: 3
        }),
        fill: new Fill({
          color: 'rgba(59, 130, 246, 0.2)'
        })
      })
    });

    // Initialize map centered on Turkey
    this.map = new Map({
      target: 'map',
      layers: [
        new TileLayer({
          source: new OSM()
        }),
        this.vectorLayer
      ],
      view: new View({
        center: transform([35.2433, 38.9637], 'EPSG:4326', 'EPSG:3857'), // Turkey center
        zoom: 6
      })
    });

    // Add modify interaction
    this.modifyInteraction = new Modify({ source: this.vectorSource });
    this.map.addInteraction(this.modifyInteraction);

    // Add snap interaction
    this.snapInteraction = new Snap({ source: this.vectorSource });
    this.map.addInteraction(this.snapInteraction);

    // Listen for modifications
    this.modifyInteraction.on('modifyend', () => {
      this.updatePolygonCoordinates();
    });

    console.log('✅ Harita başarıyla initialize edildi');
  } catch (error) {
    console.error('❌ Harita initialize edilirken hata:', error);
  }
}

  startDrawing(): void {
    if (this.isDrawing) return;

    // Clear existing polygon
    this.clearDrawing();

    // Create draw interaction for polygon
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

    // Listen for draw end
    this.drawInteraction.on('drawend', (event) => {
      this.currentPolygon = event.feature as Feature<Polygon>;
      this.hasPolygon = true;
      this.isDrawing = false;
      
      // Remove draw interaction
      this.map.removeInteraction(this.drawInteraction);
      
      // Update coordinates and area
      this.updatePolygonCoordinates();
      this.calculateArea();
    });
  }

  clearDrawing(): void {
    this.vectorSource.clear();
    this.hasPolygon = false;
    this.polygonArea = '';
    this.currentPolygon = null;
    this.tasinmazForm.get('koordinat')?.setValue('');
    
    if (this.isDrawing && this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.isDrawing = false;
    }
  }

  updatePolygonCoordinates(): void {
    if (!this.currentPolygon) {
      const features = this.vectorSource.getFeatures();
      if (features.length > 0) {
        this.currentPolygon = features[0] as Feature<Polygon>;
      }
    }

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
        // Calculate area in square meters
        const area = getArea(geometry);
        this.polygonArea = Math.round(area).toLocaleString();
      }
    }
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
}
