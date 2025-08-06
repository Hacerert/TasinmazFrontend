import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { LogService } from '../services/log.service';
import { UserService } from '../services/user.service';
import { Subscription, forkJoin } from 'rxjs';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';
import { finalize } from 'rxjs/operators';

export interface Log {
  id: number;
  status: string;
  actionType: string;
  description: string;
  createdAt: Date | null;
  ipAddress: string;
  userId?: number;
  user?: {
    id: number;
    userName: string;
    email: string;
    role: string;
  };
}

@Component({
  selector: 'app-log-list',
  templateUrl: './log-list.component.html',
  styleUrls: ['./log-list.component.css'],
  providers: [DatePipe]
})
export class LogListComponent implements OnInit, OnDestroy {
  logs: Log[] = [];
  filteredLogs: Log[] = [];
  isLoading = true;
  error: string | null = null;
  private dataSubscription: Subscription | undefined;
  allUsers: any[] = [];

  // FİLTRELEME DEĞİŞKENLERİ
  filterUserId: string = '';
  filterStatus: string = '';
  filterActionType: string = '';
  filterIpAddress: string = '';
  filterStartDate: string = '';
  filterEndDate: string = '';

  // Filtre seçenekleri için diziler
  availableStatuses: string[] = [];
  availableActionTypes: string[] = [];

  // Sayfalama Değişkenleri
  currentPage: number = 1;
  itemsPerPage: number = 8; // Her sayfada gösterilecek kayıt sayısı

  constructor(
    private logService: LogService,
    private userService: UserService,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  loadAllData(): void {
    this.isLoading = true;
    this.error = null;

    this.dataSubscription = forkJoin({
      logsData: this.logService.getLogs(),
      usersData: this.userService.getAllUsers()
    }).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (results) => {
        this.allUsers = results.usersData;
        console.log('Kullanıcılar yüklendi:', this.allUsers);

        this.logs = results.logsData.map((log: any) => {
          let parsedDate: Date | null = null;
          if (log.createdAt) {
            const tempDate = new Date(log.createdAt);
            if (!isNaN(tempDate.getTime())) {
              parsedDate = tempDate;
            } else {
              console.warn('Geçersiz createdAt formatı algılandı, log ID:', log.id, 'Değer:', log.createdAt);
            }
          }
          return {
            id: log.id,
            status: log.status,
            actionType: log.actionType,
            description: log.description,
            createdAt: parsedDate,
            ipAddress: log.ipAddress,
            userId: log.userId,
            user: log.user
          } as Log;
        });
        console.log('Loglar yüklendi ve createdAt dönüştürüldü:', this.logs);

        this.mapUserNamesToLogs();
        this.populateFilterOptions(); // Filtre seçeneklerini doldur
        this.applyFilters(); // İlk yüklemede filtreleri uygula
      },
      error: (err) => {
        console.error('Veri yüklenirken hata oluştu:', err);
        this.error = 'Veriler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
      }
    });
  }

  mapUserNamesToLogs(): void {
    if (this.logs.length > 0 && this.allUsers.length > 0) {
      this.logs = this.logs.map(log => {
        const user = this.allUsers.find(u => u.id === log.userId);
        return {
          ...log,
          user: user ? { id: user.id, userName: user.userName || user.email, email: user.email, role: user.role } : undefined
        };
      });
      console.log('Loglara kullanıcı isimleri eşleştirildi:', this.logs);
    }
  }

  populateFilterOptions(): void {
    // Tüm olası durumları ve işlem türlerini manuel olarak tanımlayalım ve sonra sıralayalım.
    // Bu, backend'den hiç gelmese bile filtrede görünmelerini sağlar.
    const fixedStatuses = ['Başarılı', 'Başarısız', 'Uyarı', 'Bilgi'];
    const fixedActionTypes = [
      'Giriş', 'Çıkış', 'Ekleme', 'Güncelleme', 'Silme', 'Görüntüleme',
      'Taşınmaz Ekleme', 'Taşınmaz Güncelleme', 'Taşınmaz Silme',
      'Kullanıcı Ekleme', 'Kullanıcı Güncelleme', 'Kullanıcı Silme', 'Kullanıcı Yönetimi'
    ];

    // Loglardan gelen benzersiz değerleri de ekleyelim (eğer farklı bir şey gelirse)
    const allStatuses = new Set([...fixedStatuses, ...this.logs.map(log => log.status).filter(s => s)]);
    const allActionTypes = new Set([...fixedActionTypes, ...this.logs.map(log => log.actionType).filter(a => a)]);

    this.availableStatuses = Array.from(allStatuses).sort();
    this.availableActionTypes = Array.from(allActionTypes).sort();

    console.log('Mevcut Durumlar (Kesinleştirilmiş):', this.availableStatuses);
    console.log('Mevcut İşlem Türleri (Kesinleştirilmiş):', this.availableActionTypes);
  }

  applyFilters(): void {
    console.log('applyFilters() çağrıldı.');
    console.log('Aktif filtre değerleri:', {
      userId: this.filterUserId,
      status: this.filterStatus,
      actionType: this.filterActionType,
      ipAddress: this.filterIpAddress,
      startDate: this.filterStartDate,
      endDate: this.filterEndDate
    });

    let tempLogs = [...this.logs]; // Her zaman orijinal log listesinden başla

    // Kullanıcı ID Filtresi
    if (this.filterUserId) {
      tempLogs = tempLogs.filter(log =>
        log.userId && log.userId.toString().toLowerCase().includes(this.filterUserId.toLowerCase())
      );
      console.log('Kullanıcı ID filtresi uygulandı. Kalan log sayısı:', tempLogs.length);
    }

    // Durum Filtresi
    if (this.filterStatus) {
      tempLogs = tempLogs.filter(log =>
        log.status && log.status.toLowerCase() === this.filterStatus.toLowerCase()
      );
      console.log('Durum filtresi uygulandı. Kalan log sayısı:', tempLogs.length);
    }

    // İşlem Türü Filtresi
    if (this.filterActionType) {
      tempLogs = tempLogs.filter(log =>
        log.actionType && log.actionType.toLowerCase().includes(this.filterActionType.toLowerCase())
      );
      console.log('İşlem Türü filtresi uygulandı. Kalan log sayısı:', tempLogs.length);
    }

    // IP Adresi Filtresi
    if (this.filterIpAddress) {
      tempLogs = tempLogs.filter(log =>
        log.ipAddress && log.ipAddress.toLowerCase().includes(this.filterIpAddress.toLowerCase())
      );
      console.log('IP Adresi filtresi uygulandı. Kalan log sayısı:', tempLogs.length);
    }

    // Başlangıç Tarihi Filtresi
    if (this.filterStartDate) {
      const startDate = new Date(this.filterStartDate);
      startDate.setHours(0, 0, 0, 0); // Günün başlangıcını ayarla
      tempLogs = tempLogs.filter(log => {
        return log.createdAt && log.createdAt instanceof Date && log.createdAt >= startDate;
      });
      console.log('Başlangıç Tarihi filtresi uygulandı. Kalan log sayısı:', tempLogs.length);
    }

    // Bitiş Tarihi Filtresi
    if (this.filterEndDate) {
      const endDate = new Date(this.filterEndDate);
      endDate.setHours(23, 59, 59, 999); // Günün sonunu ayarla
      tempLogs = tempLogs.filter(log => {
        return log.createdAt && log.createdAt instanceof Date && log.createdAt <= endDate;
      });
      console.log('Bitiş Tarihi filtresi uygulandı. Kalan log sayısı:', tempLogs.length);
    }

    this.filteredLogs = tempLogs;
    console.log('Filtreleme işlemi tamamlandı. Son filtrelenmiş log sayısı:', this.filteredLogs.length);
    this.currentPage = 1; // Filtreler uygulandığında sayfayı sıfırla
  }

  clearFilters(): void {
    this.filterUserId = '';
    this.filterStatus = '';
    this.filterActionType = '';
    this.filterIpAddress = '';
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.applyFilters(); // Filtreleri temizledikten sonra yeniden uygula
    console.log('Filtreler temizlendi.');
  }

  exportToExcel(): void {
    console.log('📊 Excel export başlatılıyor...');

    if (this.filteredLogs.length === 0) {
      console.warn('Aktarılacak log kaydı bulunmamaktadır.');
      return;
    }

    const data = this.filteredLogs.map((log, index) => ({
      'Sıra No': index + 1,
      'Log ID': log.id,
      'Kullanıcı ID': log.userId || '-',
      'Kullanıcı Adı': log.user?.userName || 'Bilinmiyor',
      'Email': log.user?.email || '-',
      'Rol': log.user?.role || '-',
      'Durum': log.status,
      'İşlem Türü': log.actionType,
      'Açıklama': log.description,
      'Tarih': log.createdAt ? this.datePipe.transform(log.createdAt, 'dd/MM/yyyy') : '-',
      'Saat': log.createdAt ? this.datePipe.transform(log.createdAt, 'HH:mm:ss') : '-',
      'IP Adresi': log.ipAddress
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    // Sütun genişliklerini daha makul değerlere ayarladım
    const columnWidths = [
      { wch: 8 },   // Sıra No
      { wch: 8 },   // Log ID
      { wch: 12 },  // Kullanıcı ID
      { wch: 20 },  // Kullanıcı Adı (daha geniş)
      { wch: 30 },  // Email (daha geniş)
      { wch: 10 },  // Rol
      { wch: 15 },  // Durum
      { wch: 20 },  // İşlem Türü
      { wch: 50 },  // Açıklama (daha da geniş)
      { wch: 12 },  // Tarih
      { wch: 10 },  // Saat
      { wch: 18 }   // IP (biraz daha geniş)
    ];
    ws['!cols'] = columnWidths;

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Log Kayıtları');

    const simdi = new Date();
    const tarih = this.datePipe.transform(simdi, 'dd-MM-yyyy');
    const saat = this.datePipe.transform(simdi, 'HH-mm-ss');
    const dosyaAdi = `Log_Kayitlari_${tarih}_${saat}.xlsx`;

    XLSX.writeFile(wb, dosyaAdi);

    console.log(`✅ Excel dosyası indirildi: ${dosyaAdi}`);
  }

  goBack(): void {
    this.router.navigate(['/admin-dashboard']);
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'başarılı':
      case 'success':
        return 'bg-green-200 text-green-800';
      case 'başarısız':
      case 'error':
      case 'failed':
        return 'bg-red-200 text-red-800';
      case 'uyarı':
      case 'warning':
        return 'bg-yellow-200 text-yellow-800';
      case 'bilgi':
      case 'info':
        return 'bg-blue-200 text-blue-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  }

  getActionClass(actionType: string): string {
    switch (actionType.toLowerCase()) {
      case 'giriş':
      case 'login':
        return 'bg-green-100 text-green-800';
      case 'çıkış':
      case 'logout':
        return 'bg-blue-100 text-blue-800';
      case 'taşınmaz ekleme':
      case 'taşınmaz güncelleme':
      case 'ekleme':
      case 'güncelleme':
        return 'bg-purple-100 text-purple-800';
      case 'taşınmaz silme':
      case 'kullanıcı silme':
      case 'silme':
        return 'bg-red-100 text-red-800';
      case 'kullanıcı yönetimi':
      case 'kullanıcı ekleme':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-indigo-100 text-indigo-800';
    }
  }

  // Sayfalama için getter'lar ve metodlar
  get totalPages(): number {
    return Math.ceil(this.filteredLogs.length / this.itemsPerPage);
  }

  get paginatedLogs(): Log[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredLogs.slice(startIndex, endIndex);
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
}
