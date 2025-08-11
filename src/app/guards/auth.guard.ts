// src/app/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators'; // 'map' operatörünü kullanmak için

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    console.log('🔒 AuthGuard çalışıyor, URL:', state.url);

    // 1. Adım: Kullanıcı giriş yapmış mı kontrol et
    const isLoggedIn = this.authService.isLoggedIn();
    console.log('🔒 Kullanıcı giriş durumu:', isLoggedIn);
    
    if (!isLoggedIn) {
      console.log('❌ Kullanıcı giriş yapmamış, login sayfasına yönlendiriliyor');
      this.router.navigate(['/login']); // Giriş yapmamışsa login sayfasına yönlendir
      return false;
    }

    // 2. Adım: Kullanıcı giriş yapmışsa rolünü kontrol et
    // Önce mevcut rolü kontrol et
    const currentRole = this.authService.getUserRole();
    console.log('🔒 Mevcut rol (sync):', currentRole);
    
    if (currentRole) {
      // Rol mevcutsa hemen kontrol et
      return this.checkRoleAccess(currentRole, state.url);
    }
    
    // Rol mevcut değilse observable'dan bekle
    return this.authService.userRole$.pipe(
      map(role => {
        console.log('🔒 Kullanıcı rolü (async):', role);
        
        if (!role) {
          // Hala rol yoksa, token'ı yeniden decode etmeyi dene
          console.log('⚠️ Rol bulunamadı, token yeniden decode ediliyor...');
          const token = this.authService.getToken();
          if (token) {
            this.authService.decodeTokenAndSetClaims(token);
            const retryRole = this.authService.getUserRole();
            if (retryRole) {
              console.log('✅ Rol bulundu (retry):', retryRole);
              return this.checkRoleAccess(retryRole, state.url);
            }
          }
          
          // Hala rol yoksa, taşınmaz sayfalarına erişime izin ver (varsayılan)
          console.log('⚠️ Rol belirlenememiş, varsayılan olarak taşınmaz erişimi veriliyor');
          if (state.url === '/tasinmazlar' || state.url.startsWith('/tasinmaz-')) {
            return true;
          }
          this.router.navigate(['/tasinmazlar']);
          return false;
        }
        
        return this.checkRoleAccess(role, state.url);
      })
    );
  }

  private checkRoleAccess(role: string, url: string): boolean {
    console.log('🔒 Rol erişimi kontrol ediliyor:', role, 'URL:', url);
    
    if (role === 'Admin') {
      console.log('🔒 Admin kullanıcı, erişim kontrol ediliyor...');
      // Admin kullanıcılar admin panel, log sayfaları ve taşınmaz sayfalarına erişebilir
      if (url.startsWith('/admin') || url === '/logs' || url === '/admin-dashboard' || url === '/admin/logs' || 
          url === '/tasinmazlar' || url.startsWith('/tasinmaz-')) {
        console.log('✅ Admin erişimi onaylandı');
        return true; // Admin paneli, alt sayfaları, log ve taşınmaz sayfalarına erişime izin ver
      } else {
        // Bilinmeyen sayfalarda varsayılan olarak admin-dashboard'a yönlendir
        console.log('⚠️ Admin bilinmeyen sayfa, admin-dashboard\'a yönlendiriliyor');
        this.router.navigate(['/admin-dashboard']);
        return false;
      }
    } else if (role === 'User') {
      console.log('🔒 User kullanıcı, erişim kontrol ediliyor...');
      // User rolü sadece taşınmaz sayfalarına erişebilir
      if (url.startsWith('/admin')) {
        // Admin sayfalarına erişimi engelle
        console.log('❌ User admin sayfasına erişmeye çalışıyor, taşınmazlar sayfasına yönlendiriliyor');
        this.router.navigate(['/tasinmazlar']);
        return false;
      } else if (url === '/tasinmazlar' || url.startsWith('/tasinmaz-')) {
        console.log('✅ User erişimi onaylandı');
        return true; // Taşınmaz sayfalarına erişime izin ver
      } else {
        // Varsayılan olarak taşınmazlar listesine yönlendir
        console.log('⚠️ User bilinmeyen sayfa, taşınmazlar sayfasına yönlendiriliyor');
        this.router.navigate(['/tasinmazlar']);
        return false;
      }
    } else {
      // Bilinmeyen rol için varsayılan olarak taşınmaz erişimi ver
      console.log('⚠️ Bilinmeyen rol, varsayılan olarak taşınmaz erişimi veriliyor');
      if (url === '/tasinmazlar' || url.startsWith('/tasinmaz-')) {
        return true;
      }
      this.router.navigate(['/tasinmazlar']);
      return false;
    }
  }
}
