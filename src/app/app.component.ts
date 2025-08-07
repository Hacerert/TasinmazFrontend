import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'tasinmazFrontend';

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    // Global URL kontrolü ve login yönlendirmesi
    console.log('🌐 App başlatıldı, URL kontrolü yapılıyor:', window.location.pathname);
    
    // Eğer ana sayfa ise direkt login'e yönlendir
    if (window.location.pathname === '/' || window.location.pathname === '') {
      console.log('🏠 Ana sayfa tespit edildi, login sayfasına yönlendiriliyor');
      this.router.navigate(['/login']);
      return;
    }
    
    // Unauthorized tasinmaz erişimini engelle
    if (window.location.pathname.includes('/tasinmaz') && !this.authService.isLoggedIn()) {
      console.log('🚫 Unauthorized taşınmaz erişimi engellendi');
      this.authService.logout();
      this.router.navigate(['/login']);
    }
    
    // Eğer giriş yapılmamış ve protected route'daysa login'e yönlendir
    const protectedRoutes = ['/admin-dashboard', '/admin/', '/logs', '/tasinmaz'];
    const isProtectedRoute = protectedRoutes.some(route => window.location.pathname.startsWith(route));
    
    if (isProtectedRoute && !this.authService.isLoggedIn()) {
      console.log('🔒 Protected route tespit edildi, giriş gerekli:', window.location.pathname);
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  export(type: 'excel' | 'pdf') {
    // Burada gerçek export işlemi yapılacak
    console.log(`${type.toUpperCase()} aktarımı başlatıldı.`);
  }
}
