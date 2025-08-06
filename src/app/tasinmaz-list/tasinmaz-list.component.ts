import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TasinmazListDto, TasinmazService } from '../services/tasinmaz.service';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-tasinmaz-list',
  templateUrl: './tasinmaz-list.component.html',
  styleUrls: ['./tasinmaz-list.component.css']
})
export class TasinmazListComponent implements OnInit {

  tasinmazlar: TasinmazListDto[] = [];
  loading: boolean = true;
  error: string | null = null;
  selectedTasinmazIds: number[] = [];
  showModal: boolean = false;
  modalMessage: string = '';
  modalCallback: Function | null = null;

  constructor(
    private tasinmazService: TasinmazService,
    private router: Router,
    private authService: AuthService,
    private datePipe: DatePipe
  ) { }

  ngOnInit(): void {
    this.getTasinmazlar();
  }

  /**
   * Veritabanından tüm taşınmazları çeker.
   */
  getTasinmazlar(): void {
    this.loading = true;
    this.tasinmazService.getTasinmazlar().subscribe({
      next: (data) => {
        this.tasinmazlar = data;
        this.loading = false;
        this.error = null;
      },
      error: (e) => {
        this.error = 'Taşınmazlar yüklenirken bir hata oluştu.';
        this.loading = false;
        console.error(e);
      }
    });
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
  exportToExcel(): void {
    console.log('📊 Taşınmaz Excel export başlatılıyor...');

    if (this.tasinmazlar.length === 0) {
      console.warn('Aktarılacak taşınmaz kaydı bulunmamaktadır.');
      return;
    }

    const data = this.tasinmazlar.map((tasinmaz, index) => ({
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
    const dosyaAdi = `Tasinmazlar_${tarih}_${saat}.xlsx`;

    XLSX.writeFile(wb, dosyaAdi);

    console.log(`✅ Excel dosyası indirildi: ${dosyaAdi}`);
  }
}
