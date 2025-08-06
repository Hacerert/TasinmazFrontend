import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TasinmazService, TasinmazListDto, TasinmazUpdateRequest } from '../services/tasinmaz.service';
import { LocationService } from '../services/location.service';

@Component({
  selector: 'app-tasinmaz-edit',
  templateUrl: './tasinmaz-edit.component.html',
  styleUrls: ['./tasinmaz-edit.component.css']
})
export class TasinmazEditComponent implements OnInit {
  tasinmazForm!: FormGroup;
  tasinmazId: number | null = null;
  iller: any[] = [];
  ilceler: any[] = [];
  mahalleler: any[] = [];
  tasinmazTipleri: string[] = ['Arsa', 'Arazi', 'Bina', 'Konut', 'Daire'];
  loading: boolean = false;
  error: string | null = null;
  successMessage: string | null = null;

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

  goBack(): void {
    this.router.navigate(['/tasinmaz-list']);
  }
}
