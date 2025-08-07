// src/app/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  username: string = '';
  password: string = '';
  errorMessage: string = '';

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit(): void {
    // ACIL: Tüm storage'ı temizle ve zorla login sayfasında kal
    console.log('🔧 Login component açıldı - storage kontrolü yapılıyor');
    
    // URL'de tasinmaz varsa zorla login'e yönlendir
    if (window.location.pathname.includes('tasinmaz')) {
      console.log('🚫 Taşınmaz URLi tespit edildi - zorla logine yönlendiriliyor');
      this.authService.logout();
      window.location.replace('/login');
      return;
    }
    
    // Kullanıcı login sayfasında kalabilsin - otomatik yönlendirme kaldırıldı
    // Eğer gerçekten otomatik yönlendirme istiyorsanız aşağıdaki kod aktif edilebilir:
    /*
    if (this.authService.isLoggedIn()) {
      this.redirectBasedOnRole();
    }
    */
  }

  onLogin(): void {
    this.errorMessage = '';
    const credentials = { username: this.username, password: this.password };

    this.authService.login(credentials).subscribe({
      next: (res) => {
        // Role observable'ı dinleyerek yönlendirme yap
        this.authService.getUserRoleObservable().subscribe(role => {
          if (role) { // Role yüklendiğinde yönlendir
            this.redirectBasedOnRoleWithParam(role);
          }
        });
      },
      error: (error) => {
        console.error('❌ Giriş hatası:', error);
        this.errorMessage = 'Giriş başarısız. Lütfen kullanıcı adı ve şifrenizi kontrol edin.';
        if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 401) {
          this.errorMessage = 'Geçersiz kullanıcı adı veya şifre.';
        } else if (error.status === 0) {
          this.errorMessage = 'Sunucuya ulaşılamadı. Backend çalışıyor mu?';
        }
      }
    });
  }

  /**
   * Kullanıcının rolüne göre uygun sayfaya yönlendirir
   */
  private redirectBasedOnRole(): void {
    const userRole = this.authService.getUserRole();
    console.log('🔍 Redirect Role Check:', userRole);
    
    if (userRole === 'Admin') {
      console.log('✅ Admin kullanıcı - Admin dashboard\'a yönlendiriliyor');
      this.router.navigate(['/admin-dashboard']);
    } else if (userRole === 'User') {
      console.log('✅ User kullanıcı - Taşınmaz listesine yönlendiriliyor');
      this.router.navigate(['/tasinmazlar']);
    } else {
      console.log('⚠️ Rol bulunamadı:', userRole, '- Varsayılan olarak taşınmaz listesine yönlendiriliyor');
      this.router.navigate(['/tasinmazlar']);
    }
  }

  /**
   * Observable'dan gelen role ile yönlendirme yapar
   */
  private redirectBasedOnRoleWithParam(userRole: string): void {
    console.log('🔍 Observable Redirect Role Check:', userRole);
    
    if (userRole === 'Admin') {
      console.log('✅ Admin kullanıcı - Admin dashboard\'a yönlendiriliyor');
      this.router.navigate(['/admin-dashboard']);
    } else if (userRole === 'User') {
      console.log('✅ User kullanıcı - Taşınmaz listesine yönlendiriliyor');
      this.router.navigate(['/tasinmazlar']);
    } else {
      console.log('⚠️ Bilinmeyen rol:', userRole, '- Varsayılan olarak taşınmaz listesine yönlendiriliyor');
      this.router.navigate(['/tasinmazlar']);
    }
  }
}
