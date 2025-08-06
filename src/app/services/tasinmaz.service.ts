import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Backend API'nizin temel URL'sini buraya yazın.
const API_URL = 'http://localhost:5000/api/Tasinmaz';

// İç içe nesneler için arayüzler
export interface IlDto {
  id: number;
  ad: string;
}

export interface IlceDto {
  id: number;
  ad: string;
  ilId: number;
  il?: IlDto;
}

export interface MahalleDto {
  id: number;
  ad: string;
  ilceId: number;
  ilce?: IlceDto;
}

// Backend'den gelen verilere uyan arayüz
export interface TasinmazListDto {
  id?: number;
  ada: string;
  parsel: string;
  adres: string;
  koordinat: string;
  tasinmazTipi?: string;
  mahalleId: number;
  mahalle?: MahalleDto;
}

// Yeni taşınmaz eklemek için kullanılan arayüz
export interface TasinmazAddRequest {
  ilId: number;
  ilceId: number;
  mahalleId: number;
  ada: string;
  parsel: string;
  adres: string;
  koordinat: string;
  tasinmazTipi: string;
  userId: string;
}

// Taşınmaz güncellemek için kullanılan arayüz (Backend CreateTasinmazDto ile uyumlu)
export interface TasinmazUpdateRequest {
  ada: string;
  parsel: string;
  adres: string;
  koordinat: string;
  mahalleId: number;
}

@Injectable({
  providedIn: 'root'
})
export class TasinmazService {
  constructor(private http: HttpClient) { }

  /**
   * Backend'den gelen TasinmazListDto listesini çeker.
   */
  getTasinmazlar(): Observable<TasinmazListDto[]> {
    return this.http.get<TasinmazListDto[]>(API_URL);
  }

  /**
   * Kullanıcı ID'sine göre TasinmazListDto listesini çeker.
   */
  getKullaniciTasinmazlarim(userId: number): Observable<TasinmazListDto[]> {
    return this.http.get<TasinmazListDto[]>(`${API_URL}/GetByUserId/${userId}`);
  }

  /**
   * Yeni bir taşınmaz ekler.
   */
  addTasinmaz(tasinmaz: TasinmazAddRequest): Observable<TasinmazAddRequest> {
    return this.http.post<TasinmazAddRequest>(API_URL, tasinmaz);
  }

  /**
   * Belirtilen ID'deki taşınmazı günceller.
   */
  updateTasinmaz(id: number, tasinmaz: TasinmazUpdateRequest): Observable<TasinmazUpdateRequest> {
    return this.http.put<TasinmazUpdateRequest>(`${API_URL}/${id}`, tasinmaz);
  }

  /**
   * Belirtilen ID'deki taşınmazı siler.
   */
  deleteTasinmaz(id: number): Observable<any> {
    return this.http.delete(`${API_URL}/${id}`);
  }
}
