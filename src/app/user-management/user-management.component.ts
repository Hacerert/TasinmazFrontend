// src/app/user-management/user-management.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { UserService } from '../services/user.service'; // Kullanıcı servisi
import { AuthService } from '../services/auth.service'; // Kimlik doğrulama servisi
import { Router } from '@angular/router'; // Router import edildi
import { Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import * as XLSX from 'xlsx';

// Kullanıcı arayüzü (interface) tanımlandı - Backend ile uyumlu
interface User {
  id: number;
  userName: string;  // Backend'deki UserName ile uyumlu
  role: string;
  email?: string;  // Backend'de Email field'ı da var
}

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit, OnDestroy {
  users: User[] = [];
  filteredUsers: User[] = []; // Filtrelenmiş kullanıcılar
  loading: boolean = true;
  error: string | null = null;
  successMessage: string | null = null;
  selectedUserIds: number[] = [];
  private userRoleSubscription: Subscription | undefined;

  // Filtreleme değişkenleri
  filterUsername: string = '';
  filterEmail: string = '';
  filterRole: string = '';

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router, // Router enjekte edildi
    private datePipe: DatePipe
  ) { }

  ngOnInit(): void {
    this.userRoleSubscription = this.authService.userRole$.subscribe(role => {
      if (role !== 'Admin') {
        this.router.navigate(['/tasinmazlar']);
      } else {
        this.loadUsers();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.userRoleSubscription) {
      this.userRoleSubscription.unsubscribe();
    }
  }
  loadUsers(): void {
    this.loading = true;
    this.error = null;
    this.userService.getAllUsers().subscribe({
      next: (data: User[]) => {
        this.users = data;
        this.filteredUsers = [...data]; // Filtrelenmiş listeyi başlat
        this.loading = false;
        console.log('Kullanıcılar başarıyla yüklendi:', this.users);
      },
      error: (err: any) => {
        console.error('Kullanıcılar yüklenirken hata oluştu:', err);
        this.error = 'Kullanıcılar yüklenirken bir hata oluştu: ' + (err.error?.message || err.message);
        this.loading = false;
        if (err.status === 401 || err.status === 403) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  /**
   * Filtreleri uygular
   */
  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      const usernameMatch = !this.filterUsername || 
        user.userName.toLowerCase().includes(this.filterUsername.toLowerCase());
      
      const emailMatch = !this.filterEmail || 
        (user.email && user.email.toLowerCase().includes(this.filterEmail.toLowerCase()));
      
      const roleMatch = !this.filterRole || 
        user.role.toLowerCase().includes(this.filterRole.toLowerCase());
      
      return usernameMatch && emailMatch && roleMatch;
    });
  }

  /**
   * Filtreleri temizler
   */
  clearFilters(): void {
    this.filterUsername = '';
    this.filterEmail = '';
    this.filterRole = '';
    this.filteredUsers = [...this.users];
  }

  deleteUser(userId: number): void {
    if (confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      this.userService.deleteUser(userId).subscribe({
        next: () => {
          this.successMessage = 'Kullanıcı başarıyla silindi.';
          this.loadUsers();
          
          // 3 saniye sonra success message'ı temizle
          setTimeout(() => {
            this.successMessage = null;
          }, 3000);
        },
        error: (err: any) => {
          console.error('Kullanıcı silinirken hata oluştu:', err);
          this.error = 'Kullanıcı silinirken bir hata oluştu: ' + (err.error?.message || err.message);
          if (err.status === 401 || err.status === 403) {
            this.authService.logout();
            this.router.navigate(['/login']);
          }
        }
      });
    }
  }

  // YENİ EKLENEN/DÜZELTİLEN: Kullanıcı düzenleme metodu
  editUser(userId: number): void {
    console.log('Kullanıcı düzenleme sayfasına yönlendiriliyor:', userId);
    this.router.navigate(['/admin/users/edit', userId]); // Kullanıcı düzenleme sayfasına yönlendir
  }

  // YENİ EKLENEN: Yeni kullanıcı ekleme metodu
  addNewUser(): void {
    console.log('Yeni kullanıcı ekleme sayfasına yönlendiriliyor.');
    this.router.navigate(['/admin/users/add']); // Yeni kullanıcı ekleme sayfasına yönlendir
  }

  logout(): void {
    console.log('🚪 UserManagement - Logout butonuna tıklandı');
    this.authService.logout();
    console.log('🔄 UserManagement - Login sayfasına yönlendiriliyor...');
    
    // Router navigation dene, başarısız olursa window.location kullan
    this.router.navigate(['/login']).then(() => {
      console.log('✅ UserManagement - Login sayfasına başarıyla yönlendirildi');
    }).catch((error) => {
      console.error('❌ UserManagement - Router navigation hatası:', error);
      console.log('🔄 UserManagement - Window.location ile yönlendiriliyor...');
      window.location.href = '/login';
    });
  }

  // Log sayfasına yönlendirme metodu
  viewLogs(): void {
    console.log('📋 UserManagement - Log sayfasına yönlendiriliyor...');
    this.router.navigate(['/logs']).then(() => {
      console.log('✅ UserManagement - Log sayfasına başarıyla yönlendirildi');
    }).catch((error) => {
      console.error('❌ UserManagement - Log sayfasına yönlendirme hatası:', error);
    });
  }

  // Checkbox işlemleri için yeni metodlar
  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      // Filtrelenmiş kullanıcıların tümünü seç
      this.selectedUserIds = this.filteredUsers.map(user => user.id!);
    } else {
      // Tümünü temizle
      this.selectedUserIds = [];
    }
  }

  onCheckboxChange(userId: number, event: any): void {
    if (event.target.checked) {
      // Kullanıcıyı seçili listesine ekle
      if (!this.selectedUserIds.includes(userId)) {
        this.selectedUserIds.push(userId);
      }
    } else {
      // Kullanıcıyı seçili listesinden çıkar
      this.selectedUserIds = this.selectedUserIds.filter(id => id !== userId);
    }
  }

  // Seçilen kullanıcıları toplu silme
  deleteSelectedUsers(): void {
    if (this.selectedUserIds.length === 0) {
      return;
    }
    
    const confirmMessage = `Seçilen ${this.selectedUserIds.length} kullanıcıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`;
    
    if (confirm(confirmMessage)) {
      this.performBulkDelete();
    }
  }

  private performBulkDelete(): void {
    let deletedCount = 0;
    const totalCount = this.selectedUserIds.length;
    
    this.selectedUserIds.forEach(userId => {
      this.userService.deleteUser(userId).subscribe({
        next: () => {
          deletedCount++;
          console.log(`Kullanıcı (ID: ${userId}) silindi.`);
          
          // Tüm silme işlemleri tamamlandığında listeyi yenile
          if (deletedCount === totalCount) {
            this.selectedUserIds = []; // Seçimleri temizle
            this.loadUsers(); // Listeyi yenile
            this.successMessage = `${deletedCount} kullanıcı başarıyla silindi.`;
            
            // 3 saniye sonra success message'ı temizle
            setTimeout(() => {
              this.successMessage = null;
            }, 3000);
          }
        },
        error: (err: any) => {
          console.error(`Kullanıcı (ID: ${userId}) silinirken hata:`, err);
          this.error = `Kullanıcı silme işlemi sırasında hata oluştu: ${err.error?.message || err.message}`;
          
          // 5 saniye sonra error message'ı temizle
          setTimeout(() => {
            this.error = null;
          }, 5000);
          
          if (err.status === 401 || err.status === 403) {
            this.authService.logout();
            this.router.navigate(['/login']);
          }
        }
      });
    });
  }

  // Seçilen kullanıcıları Excel'e aktarma
  exportSelectedToExcel(): void {
    console.log('📊 Seçilen kullanıcılar Excel export başlatılıyor...');

    if (this.selectedUserIds.length === 0) {
      console.warn('Aktarılacak kullanıcı seçilmemiş.');
      return;
    }

    // Seçilen kullanıcıları filtrele (filteredUsers'dan)
    const selectedUsers = this.filteredUsers.filter(user => this.selectedUserIds.includes(user.id!));

    const data = selectedUsers.map((user, index) => ({
      'Sıra No': index + 1,
      'ID': user.id,
      'Kullanıcı Adı': user.userName,
      'Email': user.email || '-',
      'Rol': user.role
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    // Sütun genişliklerini ayarla
    const columnWidths = [
      { wch: 8 },   // Sıra No
      { wch: 8 },   // ID
      { wch: 20 },  // Kullanıcı Adı
      { wch: 30 },  // Email
      { wch: 15 }   // Rol
    ];
    ws['!cols'] = columnWidths;

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Seçilen Kullanıcılar');

    const simdi = new Date();
    const tarih = this.datePipe.transform(simdi, 'dd-MM-yyyy');
    const saat = this.datePipe.transform(simdi, 'HH-mm-ss');
    const dosyaAdi = `Secilen_Kullanicilar_${tarih}_${saat}.xlsx`;

    XLSX.writeFile(wb, dosyaAdi);

    console.log(`✅ Excel dosyası indirildi: ${dosyaAdi}`);
  }

  // Navigasyon metodları
  goToTasinmazlar(): void {
    this.router.navigate(['/tasinmaz-list']);
  }

  goToUsers(): void {
    // Zaten kullanıcı yönetimi sayfasındayız, herhangi bir şey yapmaya gerek yok
    console.log('Zaten kullanıcılar sayfasındasınız');
  }
}
