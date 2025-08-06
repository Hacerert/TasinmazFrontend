// src/app/services/log.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

// Backend'den gelen log veri yapısını tanımlayan arayüz
// Backend Log entity: Status, ActionType, Description, CreatedAt, IpAddress, UserId, User
export interface Log {
  id: number;
  status: string; // Backend'deki Status field'ı
  actionType: string; // Backend'deki ActionType field'ı
  description: string; // Backend'deki Description field'ı
  createdAt: string; // Backend'deki CreatedAt field'ı (ISO string olarak gelir)
  ipAddress: string; // Backend'deki IpAddress field'ı
  userId?: number; // Backend'deki UserId field'ı (nullable)
  user?: {
    id: number;
    userName: string;
    email: string;
    role: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LogService {
  // Backend'inizin gerçek adresi ve portu: http://localhost:5000
  private apiUrl = 'http://localhost:5000/api/Log';

  constructor(private http: HttpClient, private authService: AuthService) { }

  // HTTP istekleri için yetkilendirme başlığını oluşturan yardımcı metod
  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const safeToken = token ?? '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${safeToken}`
    });
  }

  // Log kayıtlarını backend'den çeken metod
  getLogs(): Observable<Log[]> {
    console.log('🔍 LogService - Backend\'den loglar çekiliyor...');
    
    return this.http.get<Log[]>(this.apiUrl, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('❌ LogService - Backend bağlantı hatası:', error);
        
        // Hata durumunda mock veri döndür (fallback) - Backend structure'a uygun
        const mockLogs: Log[] = [
          { 
            id: 1, 
            status: 'Başarılı',
            actionType: 'Giriş', 
            description: 'Kullanıcı sisteme giriş yaptı', 
            createdAt: new Date().toISOString(), 
            ipAddress: '192.168.1.100',
            userId: 1,
            user: { id: 1, userName: 'admin', email: 'admin@test.com', role: 'Admin' }
          },
          { 
            id: 2, 
            status: 'Başarılı',
            actionType: 'Taşınmaz Ekleme', 
            description: 'Yeni taşınmaz kaydı oluşturuldu', 
            createdAt: new Date(Date.now() - 3600000).toISOString(), 
            ipAddress: '192.168.1.101',
            userId: 2,
            user: { id: 2, userName: 'user1', email: 'user1@test.com', role: 'User' }
          },
          { 
            id: 3, 
            status: 'Başarılı',
            actionType: 'Kullanıcı Yönetimi', 
            description: 'Kullanıcı listesi görüntülendi', 
            createdAt: new Date(Date.now() - 7200000).toISOString(), 
            ipAddress: '192.168.1.100',
            userId: 1,
            user: { id: 1, userName: 'admin', email: 'admin@test.com', role: 'Admin' }
          }
        ];
        
        console.log('🔄 LogService - Mock veriler kullanılıyor (backend bağlantısı başarısız)');
        return of(mockLogs);
      })
    );
  }

  // Yeni log kaydı oluşturma metodu (isteğe bağlı)
  createLog(logData: Partial<Log>): Observable<Log> {
    console.log('📝 LogService - Yeni log kaydı oluşturuluyor:', logData);
    
    return this.http.post<Log>(this.apiUrl, logData, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('❌ LogService - Log oluşturma hatası:', error);
        throw error;
      })
    );
  }
}
