import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Il {
  id: number;
  ad: string;
}

export interface Ilce {
  id: number;
  ad: string;
  ilId: number;
}

export interface Mahalle {
  id: number;
  ad: string;
  ilceId: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private baseUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) { }

  getIller(): Observable<Il[]> {
    return this.http.get<Il[]>(`${this.baseUrl}/Il`);
  }

  getIlceler(ilId: number): Observable<Ilce[]> {
    return this.http.get<Ilce[]>(`${this.baseUrl}/Ilce/${ilId}`);
  }

  getMahalleler(ilceId: number): Observable<Mahalle[]> {
    return this.http.get<Mahalle[]>(`${this.baseUrl}/Mahalle`);
  }

  // Tüm mahalleleri al (filter için)
  getAllMahalleler(): Observable<Mahalle[]> {
    return this.http.get<Mahalle[]>(`${this.baseUrl}/Mahalle`);
  }

  // Tüm ilçeleri al (filter için) 
  getAllIlceler(): Observable<Ilce[]> {
    return this.http.get<Ilce[]>(`${this.baseUrl}/Ilce`);
  }
}